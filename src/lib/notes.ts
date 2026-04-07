import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { type Workspace } from "../types/octarine";
import { type IndexedNote, type IndexedNoteFolder } from "../types/notes";
import { getNotesCache, getPinnedNotesCache, setNotesCache, setPinnedNotesCache } from "./cache";
import { readMarkdownFrontmatter, scanMarkdownFiles } from "./files";
import { buildSearchIndexText } from "./search";

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);

function withDefaultExcluded(directories: Set<string>): Set<string> {
  return new Set([...DEFAULT_EXCLUDED_DIRECTORY_NAMES, ...directories]);
}

function toPathSegments(pathValue: string): string[] {
  return pathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildNoteSearchFields(title: string, notePath: string, workspaceName: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedPath = notePath.toLowerCase();
  const normalizedWorkspace = workspaceName.toLowerCase();
  const noteDirectory = path.posix.dirname(normalizedPath);
  const normalizedDirectory = noteDirectory === "." ? "" : noteDirectory;
  const directorySegments = toPathSegments(normalizedDirectory);

  return {
    normalizedTitle,
    normalizedPath,
    normalizedWorkspace,
    normalizedDirectory,
    directorySegments,
    searchText: buildSearchIndexText(title, notePath, workspaceName),
  };
}

function buildIndexedNote(workspace: Workspace, relativePath: string, pinned = false): IndexedNote {
  const noteTitle = path.posix.basename(relativePath, ".md");

  return {
    id: `${workspace.name}::${relativePath}`,
    title: noteTitle,
    path: relativePath,
    workspace,
    pinned,
    ...buildNoteSearchFields(noteTitle, relativePath, workspace.name),
  };
}

function hasPinnedFrontmatter(frontmatter: string | undefined): boolean {
  if (!frontmatter) return false;
  return /^pinned\s*:\s*true\s*$/m.test(frontmatter);
}

async function scanWorkspaceNotes(workspace: Workspace, excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const files = await scanMarkdownFiles(workspace.path, excludedDirectories);
  return Promise.all(
    files.map(async (file) => {
      const frontmatter = await readMarkdownFrontmatter(file.absolute);
      return buildIndexedNote(workspace, file.relative, hasPinnedFrontmatter(frontmatter));
    }),
  );
}

function sortNotes(notes: IndexedNote[]): IndexedNote[] {
  return notes.toSorted(
    (left, right) => left.workspace.name.localeCompare(right.workspace.name) || left.path.localeCompare(right.path),
  );
}

export async function scanNotes(workspaces: Workspace[], excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const effectiveExcluded = withDefaultExcluded(excludedDirectories);
  const byWorkspace = await Promise.all(
    workspaces.map((workspace) => scanWorkspaceNotes(workspace, effectiveExcluded)),
  );

  const byId = new Map(byWorkspace.flat().map((note) => [note.id, note]));
  return sortNotes([...byId.values()]);
}

export async function loadNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = getNotesCache(workspaces, excludedDirectories);
    if (cached) {
      return cached;
    }
  }

  const notes = await scanNotes(workspaces, excludedDirectories);
  setNotesCache(notes, workspaces, excludedDirectories);
  return notes;
}

export async function loadPinnedNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = getPinnedNotesCache(workspaces, excludedDirectories);
    if (cached) {
      return cached;
    }
  }

  const notes = await loadNotes(workspaces, excludedDirectories, { refresh });
  const pinned = notes.filter((note) => note.pinned);
  setPinnedNotesCache(pinned, workspaces, excludedDirectories);
  return pinned;
}

export async function scanWorkspaceDirectories(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
): Promise<IndexedNoteFolder[]> {
  const discoveredFolderIds = new Set<string>();
  const discoveredFolders: IndexedNoteFolder[] = [];
  const foldersByWorkspace = await Promise.all(
    workspaces.map((workspace) => scanWorkspaceForNoteFolders(workspace, excludedDirectories)),
  );

  for (const workspaceFolders of foldersByWorkspace) {
    for (const folder of workspaceFolders) {
      if (discoveredFolderIds.has(folder.id)) {
        continue;
      }

      discoveredFolderIds.add(folder.id);
      discoveredFolders.push(folder);
    }
  }

  discoveredFolders.sort((left, right) => {
    const byWorkspace = left.workspace.name.localeCompare(right.workspace.name);
    if (byWorkspace !== 0) {
      return byWorkspace;
    }

    return left.path.localeCompare(right.path);
  });

  return discoveredFolders;
}

async function scanWorkspaceForNoteFolders(
  workspace: Workspace,
  excludedDirectories: Set<string>,
): Promise<IndexedNoteFolder[]> {
  const pendingDirectories: Array<{ absolutePath: string; relativePath: string }> = [
    { absolutePath: workspace.path, relativePath: "" },
  ];
  const discoveredFolders: IndexedNoteFolder[] = [
    {
      id: `${workspace.path}::.`,
      name: "Root (No folder)",
      path: "",
      workspace,
      searchText: buildSearchIndexText("root", workspace.name),
    },
  ];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDirectory.absolutePath, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory ${currentDirectory.absolutePath}: ${error}`);
    }

    for (const entry of entries) {
      const normalizedEntryName = entry.name.toLowerCase();
      const isRootLevelDailyFolder = currentDirectory.relativePath === "" && normalizedEntryName === "daily";
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        entry.name.startsWith(".") ||
        isRootLevelDailyFolder ||
        DEFAULT_EXCLUDED_DIRECTORY_NAMES.has(normalizedEntryName) ||
        excludedDirectories.has(normalizedEntryName)
      ) {
        continue;
      }

      const absolutePath = path.join(currentDirectory.absolutePath, entry.name);
      const relativePath = currentDirectory.relativePath
        ? path.posix.join(currentDirectory.relativePath, entry.name)
        : entry.name;

      discoveredFolders.push({
        id: `${workspace.path}::${relativePath}`,
        name: entry.name,
        path: relativePath,
        workspace,
        searchText: buildSearchIndexText(entry.name, relativePath, workspace.name),
      });

      pendingDirectories.push({ absolutePath, relativePath });
    }
  }

  return discoveredFolders;
}
