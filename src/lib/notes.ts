import { Dirent, Stats, promises as fs } from "node:fs";
import path from "node:path";
import { isNote, isWorkspace, type Note, type Workspace } from "../types/octarine";
import { loadStoredJson, saveStoredJson } from "./localstorage";
import { buildSearchIndexText } from "./search";

const NOTES_CACHE_KEY = "octarine.notes.v1";
const NOTES_CACHE_VERSION = 4;
const PINNED_NOTES_CACHE_KEY = "octarine.pinned-notes.v1";
const PINNED_NOTES_CACHE_VERSION = 1;
const EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);

type NotesCache = {
  version: number;
  workspaceSearchSignature: string;
  scannedAt: string;
  workspaces: Workspace[];
  notes: IndexedNote[];
};

type PinnedNoteFileCacheEntry = {
  key: string;
  workspacePath: string;
  relativePath: string;
  mtimeMs: number;
  size: number;
  pinned: boolean;
};

type PinnedNotesCache = {
  version: number;
  workspaceSearchSignature: string;
  scannedAt: string;
  workspaces: Workspace[];
  notes: IndexedNote[];
  fileEntries: PinnedNoteFileCacheEntry[];
};

export type ScannedNote = Note & {
  id: string;
};

export type IndexedNote = ScannedNote & {
  normalizedTitle: string;
  normalizedPath: string;
  normalizedWorkspace: string;
  normalizedDirectory: string;
  directorySegments: string[];
  searchText: string;
};

export type IndexedNoteFolder = {
  id: string;
  name: string;
  path: string;
  workspace: Workspace;
  searchText: string;
};

export type NotesCacheResult = {
  workspaces: Workspace[];
  notes: IndexedNote[];
};

export type PinnedNotesCacheResult = NotesCacheResult;

function toPathSegments(pathValue: string): string[] {
  return pathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function toPosixPath(inputPath: string): string {
  return inputPath.split(path.sep).join(path.posix.sep);
}

function isIndexedNote(value: unknown): value is IndexedNote {
  return (
    isNote(value) &&
    typeof (value as IndexedNote).id === "string" &&
    typeof (value as IndexedNote).normalizedTitle === "string" &&
    typeof (value as IndexedNote).normalizedPath === "string" &&
    typeof (value as IndexedNote).normalizedWorkspace === "string" &&
    typeof (value as IndexedNote).normalizedDirectory === "string" &&
    Array.isArray((value as IndexedNote).directorySegments) &&
    (value as IndexedNote).directorySegments.every((segment) => typeof segment === "string") &&
    typeof (value as IndexedNote).searchText === "string"
  );
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

function buildPinnedNoteCacheKey(workspacePath: string, relativePath: string): string {
  return `${workspacePath}::${relativePath}`;
}

function isPinnedNoteFileCacheEntry(value: unknown): value is PinnedNoteFileCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<PinnedNoteFileCacheEntry>;
  return (
    typeof entry.key === "string" &&
    typeof entry.workspacePath === "string" &&
    typeof entry.relativePath === "string" &&
    typeof entry.mtimeMs === "number" &&
    Number.isFinite(entry.mtimeMs) &&
    typeof entry.size === "number" &&
    Number.isFinite(entry.size) &&
    typeof entry.pinned === "boolean"
  );
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

function isPinnedNotesCache(value: unknown): value is PinnedNotesCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cache = value as Partial<PinnedNotesCache>;
  return (
    cache.version === PINNED_NOTES_CACHE_VERSION &&
    typeof cache.workspaceSearchSignature === "string" &&
    typeof cache.scannedAt === "string" &&
    Array.isArray(cache.workspaces) &&
    cache.workspaces.every(isWorkspace) &&
    Array.isArray(cache.notes) &&
    cache.notes.every(isIndexedNote) &&
    Array.isArray(cache.fileEntries) &&
    cache.fileEntries.every(isPinnedNoteFileCacheEntry)
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

export async function loadCachedPinnedNotes(
  workspaceSearchSignature: string,
): Promise<PinnedNotesCacheResult | undefined> {
  const cached = await loadStoredJson(PINNED_NOTES_CACHE_KEY, isPinnedNotesCache);

  if (!cached || cached.workspaceSearchSignature !== workspaceSearchSignature) {
    return undefined;
  }

  return {
    workspaces: cached.workspaces,
    notes: cached.notes,
  };
}

export function toPinnedNoteIds(notes: IndexedNote[]): Set<string> {
  return new Set(notes.map((note) => note.id));
}

function extractFrontmatter(content: string): string | undefined {
  const normalizedContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = normalizedContent.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return undefined;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (/^(---|\.\.\.)\s*$/.test(lines[index].trim())) {
      return lines.slice(1, index).join("\n");
    }
  }

  return undefined;
}

// Keep pinned detection intentionally small and explicit for the current use case.
function hasPinnedFrontmatter(content: string): boolean {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return false;
  }

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = /^pinned\s*:\s*(.+)$/.exec(trimmedLine);
    if (!match) {
      continue;
    }

    const normalizedValue = match[1]
      .replace(/\s+#.*$/, "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase();
    return normalizedValue === "true";
  }

  return false;
}

export function sortNotes(notes: ScannedNote[]): void {
  notes.sort((left, right) => {
    const byWorkspace = left.workspace.name.localeCompare(right.workspace.name);
    if (byWorkspace !== 0) {
      return byWorkspace;
    }

    return left.path.localeCompare(right.path);
  });
}

export async function scanWorkspaceForNotes(
  workspace: Workspace,
  excludedDirectoryNames: Set<string>,
  onError: (error: unknown) => Promise<void>,
): Promise<IndexedNote[]> {
  const pendingDirectories: string[] = [workspace.path];
  const discoveredNotes: IndexedNote[] = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      console.error("Failed to read directory during note scan", {
        workspace: workspace.path,
        directory: currentDirectory,
        error,
      });
      await onError(error);
      continue;
    }

    for (const entry of entries) {
      const normalizedEntryName = entry.name.toLowerCase();
      if (
        entry.isDirectory() &&
        (EXCLUDED_DIRECTORY_NAMES.has(normalizedEntryName) || excludedDirectoryNames.has(normalizedEntryName))
      ) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
        continue;
      }

      const relativePath = toPosixPath(path.relative(workspace.path, absolutePath));
      discoveredNotes.push(buildIndexedNote(workspace, relativePath));
    }
  }

  return discoveredNotes;
}

export async function scanNotesFromWorkspaces(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
  onError: (error: unknown) => Promise<void>,
): Promise<IndexedNote[]> {
  const discoveredNoteIds = new Set<string>();
  const discoveredNotes: IndexedNote[] = [];
  const notesByWorkspace = await Promise.all(
    workspaces.map((workspace) => scanWorkspaceForNotes(workspace, excludedDirectoryNames, onError)),
  );

  for (const workspaceNotes of notesByWorkspace) {
    for (const note of workspaceNotes) {
      if (discoveredNoteIds.has(note.id)) {
        continue;
      }

      discoveredNoteIds.add(note.id);
      discoveredNotes.push(note);
    }
  }

  sortNotes(discoveredNotes);
  return discoveredNotes;
}

async function scanWorkspaceForPinnedNotes(
  workspace: Workspace,
  excludedDirectoryNames: Set<string>,
  cachedEntriesByKey: Map<string, PinnedNoteFileCacheEntry>,
  onError: (error: unknown) => Promise<void>,
): Promise<{ notes: IndexedNote[]; fileEntries: PinnedNoteFileCacheEntry[] }> {
  const pendingDirectories: string[] = [workspace.path];
  const discoveredNotes: IndexedNote[] = [];
  const fileEntries: PinnedNoteFileCacheEntry[] = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      console.error("Failed to read directory during pinned note scan", {
        workspace: workspace.path,
        directory: currentDirectory,
        error,
      });
      await onError(error);
      continue;
    }

    for (const entry of entries) {
      const normalizedEntryName = entry.name.toLowerCase();
      if (
        entry.isDirectory() &&
        (EXCLUDED_DIRECTORY_NAMES.has(normalizedEntryName) || excludedDirectoryNames.has(normalizedEntryName))
      ) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
        continue;
      }

      let fileStats: Stats;
      try {
        fileStats = await fs.stat(absolutePath);
      } catch (error) {
        console.error("Failed to stat note during pinned note scan", {
          workspace: workspace.path,
          path: absolutePath,
          error,
        });
        await onError(error);
        continue;
      }

      const relativePath = toPosixPath(path.relative(workspace.path, absolutePath));
      const cacheKey = buildPinnedNoteCacheKey(workspace.path, relativePath);
      const cachedEntry = cachedEntriesByKey.get(cacheKey);

      if (cachedEntry && cachedEntry.mtimeMs === fileStats.mtimeMs && cachedEntry.size === fileStats.size) {
        fileEntries.push(cachedEntry);
        if (cachedEntry.pinned) {
          discoveredNotes.push(buildIndexedNote(workspace, relativePath));
        }
        continue;
      }

      let noteContent: string;
      try {
        noteContent = await fs.readFile(absolutePath, "utf8");
      } catch (error) {
        console.error("Failed to read note during pinned note scan", {
          workspace: workspace.path,
          path: absolutePath,
          error,
        });
        await onError(error);
        continue;
      }

      const pinned = hasPinnedFrontmatter(noteContent);
      const fileEntry: PinnedNoteFileCacheEntry = {
        key: cacheKey,
        workspacePath: workspace.path,
        relativePath,
        mtimeMs: fileStats.mtimeMs,
        size: fileStats.size,
        pinned,
      };

      fileEntries.push(fileEntry);
      if (pinned) {
        discoveredNotes.push(buildIndexedNote(workspace, relativePath));
      }
    }
  }

  return {
    notes: discoveredNotes,
    fileEntries,
  };
}

export async function refreshPinnedNotesCache(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
  workspaceSearchSignature: string,
  onError: (error: unknown) => Promise<void>,
): Promise<IndexedNote[]> {
  const cached = await loadStoredJson(PINNED_NOTES_CACHE_KEY, isPinnedNotesCache);
  const cachedEntriesByKey = new Map<string, PinnedNoteFileCacheEntry>();

  if (cached && cached.workspaceSearchSignature === workspaceSearchSignature) {
    for (const entry of cached.fileEntries) {
      cachedEntriesByKey.set(entry.key, entry);
    }
  }

  const discoveredNoteIds = new Set<string>();
  const discoveredNotes: IndexedNote[] = [];
  const fileEntries: PinnedNoteFileCacheEntry[] = [];
  const notesByWorkspace = await Promise.all(
    workspaces.map((workspace) =>
      scanWorkspaceForPinnedNotes(workspace, excludedDirectoryNames, cachedEntriesByKey, onError),
    ),
  );

  for (const workspaceResult of notesByWorkspace) {
    fileEntries.push(...workspaceResult.fileEntries);

    for (const note of workspaceResult.notes) {
      if (discoveredNoteIds.has(note.id)) {
        continue;
      }

      discoveredNoteIds.add(note.id);
      discoveredNotes.push(note);
    }
  }

  sortNotes(discoveredNotes);

  await saveStoredJson(PINNED_NOTES_CACHE_KEY, {
    version: PINNED_NOTES_CACHE_VERSION,
    workspaceSearchSignature,
    scannedAt: new Date().toISOString(),
    workspaces,
    notes: discoveredNotes,
    fileEntries,
  });

  return discoveredNotes;
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
        EXCLUDED_DIRECTORY_NAMES.has(normalizedEntryName) ||
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
