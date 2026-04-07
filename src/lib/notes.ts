import path from "node:path";
import { type Workspace } from "../types/octarine";
import { type IndexedNote, type IndexedNoteFolder } from "../types/notes";
import { getNotesCache, getPinnedNotesCache, setNotesCache, setPinnedNotesCache } from "./cache";
import { readMarkdownFrontmatter, scanDirectories, scanMarkdownFiles } from "./files";
import { buildSearchIndexText } from "./search";

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);
const DAILY_FOLDER_RELATIVE_PATH = "daily";

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
  const effectiveExcluded = withDefaultExcluded(excludedDirectories);
  const foldersByWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const discoveredDirectories = await scanDirectories(workspace.path, effectiveExcluded);

      return [
        {
          id: `${workspace.path}::.`,
          name: "Root (No folder)",
          path: "",
          workspace,
          searchText: buildSearchIndexText("root", workspace.name),
        },
        ...discoveredDirectories
          .filter((dir) => dir.relative !== DAILY_FOLDER_RELATIVE_PATH)
          .map((directory) => ({
            id: `${workspace.path}::${directory.relative}`,
            name: directory.name,
            path: directory.relative,
            workspace,
            searchText: buildSearchIndexText(directory.name, directory.relative, workspace.name),
          })),
      ];
    }),
  );

  return foldersByWorkspace.flat().sort((a, b) => {
    const byWorkspace = a.workspace.name.localeCompare(b.workspace.name);
    return byWorkspace !== 0 ? byWorkspace : a.path.localeCompare(b.path);
  });
}
