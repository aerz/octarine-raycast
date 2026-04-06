import { Cache } from "@raycast/api";
import { isWorkspace, type Workspace } from "../types/octarine";
import { isIndexedNote, type IndexedNote } from "../types/notes";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";
const PINNED_NOTES_CACHE_KEY = "octarine.pinned-notes.v1";
const CACHE_TTL = 15 * 60 * 1000;

const cache = new Cache();

type CacheEntry<T> = {
  cachedAt: number;
  data: T;
};

function readCache<T>(key: string, isValid: (v: unknown) => v is T): T | undefined {
  const raw = cache.get(key);
  if (!raw) return undefined;

  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (typeof entry?.cachedAt !== "number" || !isValid(entry.data)) return undefined;
    return Date.now() - entry.cachedAt <= CACHE_TTL ? entry.data : undefined;
  } catch {
    return undefined;
  }
}

function writeCache<T>(key: string, data: T): void {
  cache.set(key, JSON.stringify({ cachedAt: Date.now(), data }));
}

function workspacesKey(roots: string[]): string {
  return `${WORKSPACES_CACHE_KEY}.${JSON.stringify([...roots].sort())}`;
}

function pinnedNotesKey(workspaces: Workspace[], excludedDirectoryNames: Set<string>): string {
  return `${PINNED_NOTES_CACHE_KEY}.${JSON.stringify({
    workspaces: workspaces.map((w) => w.path).sort(),
    excludedDirectoryNames: [...excludedDirectoryNames].sort(),
  })}`;
}

function isWorkspaceArray(v: unknown): v is Workspace[] {
  return Array.isArray(v) && v.every(isWorkspace);
}

function isIndexedNoteArray(v: unknown): v is IndexedNote[] {
  return Array.isArray(v) && v.every(isIndexedNote);
}

export function getWorkspacesCache(roots: string[]): Workspace[] | undefined {
  return readCache(workspacesKey(roots), isWorkspaceArray);
}

export function setWorkspacesCache(workspaces: Workspace[], roots: string[]): void {
  writeCache(workspacesKey(roots), workspaces);
}

export function getPinnedNotesCache(
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
): IndexedNote[] | undefined {
  return readCache(pinnedNotesKey(workspaces, excludedDirectoryNames), isIndexedNoteArray);
}

export function setPinnedNotesCache(
  notes: IndexedNote[],
  workspaces: Workspace[],
  excludedDirectoryNames: Set<string>,
): void {
  writeCache(pinnedNotesKey(workspaces, excludedDirectoryNames), notes);
}
