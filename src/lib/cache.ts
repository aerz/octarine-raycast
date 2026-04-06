import { Cache } from "@raycast/api";
import { isWorkspace, type Workspace } from "../types/octarine";
import { isIndexedNote, type IndexedNote } from "../types/notes";
import type { ScanWorkspacesResult } from "./workspaces";

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

function isWorkspacesCache(v: unknown): v is ScanWorkspacesResult {
  if (!v || typeof v !== "object") return false;

  const { workspaces, invalidRoots } = v as ScanWorkspacesResult;
  return isWorkspaceArray(workspaces) && Array.isArray(invalidRoots) && invalidRoots.every((root) => typeof root === "string");
}

function isIndexedNoteArray(v: unknown): v is IndexedNote[] {
  return Array.isArray(v) && v.every(isIndexedNote);
}

export function getWorkspacesCache(roots: string[]): ScanWorkspacesResult | undefined {
  const data = readCache(
    workspacesKey(roots),
    (v): v is ScanWorkspacesResult | Workspace[] => isWorkspacesCache(v) || isWorkspaceArray(v),
  );
  if (!data) return undefined;

  return isWorkspaceArray(data) ? { workspaces: data, invalidRoots: [] } : data;
}

export function setWorkspacesCache(workspaces: Workspace[], roots: string[], invalidRoots: string[]): void {
  writeCache(workspacesKey(roots), { workspaces, invalidRoots });
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
