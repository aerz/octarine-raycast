import { LocalStorage, getPreferenceValues } from "@raycast/api";
import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { Workspace, parseWorkspaceRoots } from "./workspaces";

const NOTES_CACHE_KEY = "octarine.notes.v1";
const CACHE_VERSION = 2;
const EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);

type NotesCachePreferences = {
  workspaceRoots: string;
  excludedFolders?: string;
};

type NotesCache = {
  version: number;
  rootsDiscoverySignature: string;
  scannedAt: string;
  workspaces: Workspace[];
  notes: OctarineNote[];
};

export type OctarineNote = {
  id: string;
  title: string;
  subtitle: string;
  workspace: string;
  normalizedTitle: string;
  normalizedSubtitle: string;
  normalizedWorkspace: string;
  normalizedDirectory: string;
  directorySegments: string[];
  searchText: string;
};

export type NotesCacheResult = {
  workspaces: Workspace[];
  notes: OctarineNote[];
};

function normalizeSearchPart(searchPart: string): string {
  return searchPart.trim().toLowerCase().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function toPathSegments(pathValue: string): string[] {
  return pathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesDirectoryScopeAtAnyDepth(noteDirectorySegments: string[], directoryQuery: string): boolean {
  const querySegments = toPathSegments(directoryQuery);
  if (querySegments.length === 0) {
    return true;
  }

  if (noteDirectorySegments.length < querySegments.length) {
    return false;
  }

  for (let start = 0; start <= noteDirectorySegments.length - querySegments.length; start += 1) {
    let matchesAllSegments = true;

    for (let index = 0; index < querySegments.length; index += 1) {
      if (noteDirectorySegments[start + index] !== querySegments[index]) {
        matchesAllSegments = false;
        break;
      }
    }

    if (matchesAllSegments) {
      return true;
    }
  }

  return false;
}

function toPosixPath(inputPath: string): string {
  return inputPath.split(path.sep).join(path.posix.sep);
}

function parseExcludedFolders(rawValue?: string): Set<string> {
  const excludedFolders = new Set<string>();

  if (!rawValue) {
    return excludedFolders;
  }

  for (const part of rawValue.split(",")) {
    const normalized = part.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    excludedFolders.add(normalized);
  }

  return excludedFolders;
}

function computeRootsDiscoverySignature(roots: string[], excludedFolders: Set<string>): string {
  const rootsSignature = [...roots].sort().join("|");
  const excludedFoldersSignature = [...excludedFolders].sort().join("|");
  return `${rootsSignature}::${excludedFoldersSignature}`;
}

function isWorkspace(value: unknown): value is Workspace {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as Workspace).name === "string" &&
    typeof (value as Workspace).path === "string"
  );
}

function isOctarineNote(value: unknown): value is OctarineNote {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as OctarineNote).id === "string" &&
    typeof (value as OctarineNote).title === "string" &&
    typeof (value as OctarineNote).subtitle === "string" &&
    typeof (value as OctarineNote).workspace === "string" &&
    typeof (value as OctarineNote).normalizedTitle === "string" &&
    typeof (value as OctarineNote).normalizedSubtitle === "string" &&
    typeof (value as OctarineNote).normalizedWorkspace === "string" &&
    typeof (value as OctarineNote).normalizedDirectory === "string" &&
    Array.isArray((value as OctarineNote).directorySegments) &&
    (value as OctarineNote).directorySegments.every((segment) => typeof segment === "string") &&
    typeof (value as OctarineNote).searchText === "string"
  );
}

function buildNoteSearchFields(title: string, subtitle: string, workspace: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedSubtitle = subtitle.toLowerCase();
  const normalizedWorkspace = workspace.toLowerCase();
  const noteDirectory = path.posix.dirname(normalizedSubtitle);
  const normalizedDirectory = noteDirectory === "." ? "" : noteDirectory;
  const directorySegments = toPathSegments(normalizedDirectory);

  return {
    normalizedTitle,
    normalizedSubtitle,
    normalizedWorkspace,
    normalizedDirectory,
    directorySegments,
    searchText: `${normalizedTitle} ${normalizedSubtitle} ${normalizedWorkspace}`,
  };
}

function isNotesCache(value: unknown): value is NotesCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cache = value as Partial<NotesCache>;
  return (
    cache.version === CACHE_VERSION &&
    typeof cache.rootsDiscoverySignature === "string" &&
    typeof cache.scannedAt === "string" &&
    Array.isArray(cache.workspaces) &&
    cache.workspaces.every(isWorkspace) &&
    Array.isArray(cache.notes) &&
    cache.notes.every(isOctarineNote)
  );
}

async function loadCache(): Promise<NotesCache | undefined> {
  const cachedValue = await LocalStorage.getItem<string>(NOTES_CACHE_KEY);
  if (!cachedValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isNotesCache(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveCache(cache: NotesCache): Promise<void> {
  await LocalStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(cache));
}

export async function loadCachedNotes(): Promise<NotesCacheResult | undefined> {
  const preferences = getPreferenceValues<NotesCachePreferences>();
  const roots = parseWorkspaceRoots(preferences.workspaceRoots);
  const excludedFolders = parseExcludedFolders(preferences.excludedFolders);
  const rootsDiscoverySignature = computeRootsDiscoverySignature(roots, excludedFolders);
  const cached = await loadCache();

  if (!cached || cached.rootsDiscoverySignature !== rootsDiscoverySignature) {
    return undefined;
  }

  return {
    workspaces: cached.workspaces,
    notes: cached.notes,
  };
}

export async function saveCachedNotes(workspaces: Workspace[], notes: OctarineNote[]): Promise<void> {
  const preferences = getPreferenceValues<NotesCachePreferences>();
  const roots = parseWorkspaceRoots(preferences.workspaceRoots);
  const excludedFolders = parseExcludedFolders(preferences.excludedFolders);
  const rootsDiscoverySignature = computeRootsDiscoverySignature(roots, excludedFolders);

  await saveCache({
    version: CACHE_VERSION,
    rootsDiscoverySignature,
    scannedAt: new Date().toISOString(),
    workspaces,
    notes,
  });
}

export function matchesSearchQuery(note: OctarineNote, searchText: string): boolean {
  const normalizedQuery = normalizeSearchPart(searchText);
  if (!normalizedQuery) {
    return true;
  }

  const hasSlash = normalizedQuery.includes("/");

  if (!hasSlash) {
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }

    return tokens.every((token) => note.searchText.includes(token));
  }

  const hasTrailingSlash = normalizedQuery.endsWith("/");
  const queryWithoutOuterSlashes = normalizedQuery.replace(/^\/+|\/+$/g, "");

  if (hasTrailingSlash) {
    return matchesDirectoryScopeAtAnyDepth(note.directorySegments, queryWithoutOuterSlashes);
  }

  const fuzzyPathMatch =
    note.normalizedDirectory.includes(queryWithoutOuterSlashes) ||
    note.normalizedSubtitle.includes(queryWithoutOuterSlashes);

  const lastSlashIndex = queryWithoutOuterSlashes.lastIndexOf("/");
  const directoryPrefix = lastSlashIndex === -1 ? "" : queryWithoutOuterSlashes.slice(0, lastSlashIndex).trim();
  const titleQuery =
    lastSlashIndex === -1 ? queryWithoutOuterSlashes : queryWithoutOuterSlashes.slice(lastSlashIndex + 1).trim();
  const titleTokens = titleQuery.split(/\s+/).filter(Boolean);

  const scopedTitleMatch =
    matchesDirectoryScopeAtAnyDepth(note.directorySegments, directoryPrefix) &&
    (titleTokens.length === 0 || titleTokens.every((token) => note.normalizedTitle.includes(token)));

  return fuzzyPathMatch || scopedTitleMatch;
}

export function buildOctarineUrl(note: OctarineNote): string {
  return `octarine://open?path=${encodeURIComponent(note.subtitle)}&workspace=${encodeURIComponent(note.workspace)}`;
}

export function sortNotes(notes: OctarineNote[]): void {
  notes.sort((left, right) => {
    const byWorkspace = left.workspace.localeCompare(right.workspace);
    if (byWorkspace !== 0) {
      return byWorkspace;
    }

    return left.subtitle.localeCompare(right.subtitle);
  });
}

export async function scanWorkspaceForNotes(
  workspace: Workspace,
  onError: (error: unknown) => Promise<void>,
): Promise<OctarineNote[]> {
  const pendingDirectories: string[] = [workspace.path];
  const discoveredNotes: OctarineNote[] = [];

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
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name) && entry.isDirectory()) {
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
      const noteTitle = path.basename(entry.name, ".md");

      discoveredNotes.push({
        id: `${workspace.name}::${relativePath}`,
        title: noteTitle,
        subtitle: relativePath,
        workspace: workspace.name,
        ...buildNoteSearchFields(noteTitle, relativePath, workspace.name),
      });
    }
  }

  return discoveredNotes;
}

export async function scanNotesFromWorkspaces(
  workspaces: Workspace[],
  onError: (error: unknown) => Promise<void>,
): Promise<OctarineNote[]> {
  const discoveredNoteIds = new Set<string>();
  const discoveredNotes: OctarineNote[] = [];
  const notesByWorkspace = await Promise.all(workspaces.map((workspace) => scanWorkspaceForNotes(workspace, onError)));

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
