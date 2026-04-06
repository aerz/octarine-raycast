import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { isWorkspace, type Workspace } from "../types/octarine";
import { type IndexedNote, type IndexedNoteFolder, type ScannedNote, isIndexedNote } from "../types/notes";
import { getPinnedNotesCache, setPinnedNotesCache } from "./cache";
import { readMarkdownFrontmatter, scanMarkdownFiles } from "./files";
import { loadStoredJson, saveStoredJson } from "./localstorage";
import { buildSearchIndexText } from "./search";

const NOTES_CACHE_KEY = "octarine.notes.v1";
const NOTES_CACHE_VERSION = 4;
const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);

type NotesCache = {
  version: number;
  workspaceSearchSignature: string;
  scannedAt: string;
  workspaces: Workspace[];
  notes: IndexedNote[];
};

export type NotesCacheResult = {
  workspaces: Workspace[];
  notes: IndexedNote[];
};

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

function buildIndexedNote(workspace: Workspace, relativePath: string): IndexedNote {
  const noteTitle = path.posix.basename(relativePath, ".md");

  return {
    id: `${workspace.name}::${relativePath}`,
    title: noteTitle,
    path: relativePath,
    workspace,
    ...buildNoteSearchFields(noteTitle, relativePath, workspace.name),
  };
}

function isNotesCache(value: unknown): value is NotesCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cache = value as Partial<NotesCache>;
  return (
    cache.version === NOTES_CACHE_VERSION &&
    typeof cache.workspaceSearchSignature === "string" &&
    typeof cache.scannedAt === "string" &&
    Array.isArray(cache.workspaces) &&
    cache.workspaces.every(isWorkspace) &&
    Array.isArray(cache.notes) &&
    cache.notes.every(isIndexedNote)
  );
}

export async function loadCachedNotes(workspaceSearchSignature: string): Promise<NotesCacheResult | undefined> {
  const cached = await loadStoredJson(NOTES_CACHE_KEY, isNotesCache);

  if (!cached || cached.workspaceSearchSignature !== workspaceSearchSignature) {
    return undefined;
  }

  return {
    workspaces: cached.workspaces,
    notes: cached.notes,
  };
}

export async function saveCachedNotes(
  workspaces: Workspace[],
  notes: IndexedNote[],
  workspaceSearchSignature: string,
): Promise<void> {
  await saveStoredJson(NOTES_CACHE_KEY, {
    version: NOTES_CACHE_VERSION,
    workspaceSearchSignature,
    scannedAt: new Date().toISOString(),
    workspaces,
    notes,
  });
}

export function toPinnedNoteIds(notes: IndexedNote[]): Set<string> {
  return new Set(notes.map((note) => note.id));
}

function hasPinnedFrontmatter(frontmatter: string | undefined): boolean {
  if (!frontmatter) return false;
  return /^pinned\s*:\s*true\s*$/m.test(frontmatter);
}

function sortNotes<T extends ScannedNote>(notes: T[]): T[] {
  return notes.toSorted(
    (left, right) => left.workspace.name.localeCompare(right.workspace.name) || left.path.localeCompare(right.path),
  );
}

export async function scanWorkspaceForNotes(
  workspace: Workspace,
  excludedDirectoryNames: Set<string>,
): Promise<IndexedNote[]> {
  const excluded = new Set([...DEFAULT_EXCLUDED_DIRECTORY_NAMES, ...excludedDirectoryNames]);
  const discoveredFiles = await scanMarkdownFiles(workspace.path, excluded);
  return discoveredFiles.map((file) => buildIndexedNote(workspace, file.relative));
}

export async function scanNotesFromWorkspaces(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
): Promise<IndexedNote[]> {
  const discoveredNoteIds = new Set<string>();
  const discoveredNotes: IndexedNote[] = [];

  for (const workspace of workspaces) {
    const workspaceNotes = await scanWorkspaceForNotes(workspace, excludedDirectoryNames);

    for (const note of workspaceNotes) {
      if (discoveredNoteIds.has(note.id)) {
        continue;
      }

      discoveredNoteIds.add(note.id);
      discoveredNotes.push(note);
    }
  }

  return sortNotes(discoveredNotes);
}

async function scanPinnedNotes(workspaces: Workspace[], excludedDirectoryNames: Set<string>): Promise<IndexedNote[]> {
  const excluded = new Set([...DEFAULT_EXCLUDED_DIRECTORY_NAMES, ...excludedDirectoryNames]);
  const byWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const files = await scanMarkdownFiles(workspace.path, excluded);
      const withFrontmatter = await Promise.all(
        files.map(async (file) => ({
          path: file.relative,
          frontmatter: await readMarkdownFrontmatter(file.absolute),
        })),
      );

      return withFrontmatter
        .filter((file) => hasPinnedFrontmatter(file.frontmatter))
        .map((file) => buildIndexedNote(workspace, file.path));
    }),
  );

  const byId = new Map(byWorkspace.flat().map((note) => [note.id, note]));
  return sortNotes([...byId.values()]);
}

export async function loadPinnedNotes(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = getPinnedNotesCache(workspaces, excludedDirectoryNames);
    if (cached) {
      return cached;
    }
  }

  const notes = await scanPinnedNotes(workspaces, excludedDirectoryNames);
  setPinnedNotesCache(notes, workspaces, excludedDirectoryNames);
  return notes;
}

export async function scanWorkspaceForNoteFolders(
  workspace: Workspace,
  excludedDirectoryNames: Set<string>,
  onError: (error: unknown) => Promise<void>,
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
      console.error("Failed to read directory during folder scan", {
        workspace: workspace.path,
        directory: currentDirectory.absolutePath,
        error,
      });
      await onError(error);
      continue;
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
        excludedDirectoryNames.has(normalizedEntryName)
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

export async function scanNoteFoldersFromWorkspaces(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
  onError: (error: unknown) => Promise<void>,
): Promise<IndexedNoteFolder[]> {
  const discoveredFolderIds = new Set<string>();
  const discoveredFolders: IndexedNoteFolder[] = [];
  const foldersByWorkspace = await Promise.all(
    workspaces.map((workspace) => scanWorkspaceForNoteFolders(workspace, excludedDirectoryNames, onError)),
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
