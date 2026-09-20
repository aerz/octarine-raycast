import { Cache } from "@raycast/api";
import { isIndexedAttachment, type IndexedAttachment } from "../types/attachments";
import { isIndexedNote, type IndexedNote } from "../types/notes";
import type { Workspace } from "../types/octarine";
import { isIndexedWorkspace, type IndexedWorkspace } from "../types/workspaces";

const CACHE_TTL = 15 * 60 * 1000;

const cache = new Cache();

type CacheEntry<T> = {
  cachedAt: number;
  data: T;
};

type CacheConfig<T, Args extends unknown[]> = {
  key: (...args: Args) => string;
  isValid: (value: unknown) => value is T;
};

function readCache<T>(key: string, isValid: (value: unknown) => value is T): T | undefined {
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

function createCache<T, Args extends unknown[]>(config: CacheConfig<T, Args>) {
  return {
    read(...args: Args): T | undefined {
      return readCache(config.key(...args), config.isValid);
    },

    write(data: T, ...args: Args): void {
      writeCache(config.key(...args), data);
    },
  };
}

function isIndexedWorkspaceArray(value: unknown): value is IndexedWorkspace[] {
  return Array.isArray(value) && value.every(isIndexedWorkspace);
}

function isIndexedNoteArray(value: unknown): value is IndexedNote[] {
  return Array.isArray(value) && value.every(isIndexedNote);
}

function isIndexedAttachmentArray(value: unknown): value is IndexedAttachment[] {
  return Array.isArray(value) && value.every(isIndexedAttachment);
}

export const WorkspacesCache = createCache<IndexedWorkspace[], [string[], Set<string>]>({
  key(roots, excludedDirectories) {
    const prefix = "octarine.workspaces.v2";
    return `${prefix}.${JSON.stringify({
      roots: [...roots].sort(),
      excludedDirectories: [...excludedDirectories].sort(),
    })}`;
  },

  isValid: isIndexedWorkspaceArray,
});

export const NotesCache = createCache<IndexedNote[], [Workspace[], Set<string>]>({
  key(workspaces, excludedDirectories) {
    const prefix = "octarine.notes.v1";
    return `${prefix}.${JSON.stringify({
      workspaces: workspaces.map((workspace) => workspace.path).sort(),
      excludedDirectories: [...excludedDirectories].sort(),
    })}`;
  },

  isValid: isIndexedNoteArray,
});

export const PinnedNotesCache = createCache<IndexedNote[], [Workspace[], Set<string>]>({
  key(workspaces, excludedDirectories) {
    const prefix = "octarine.pinned-notes.v1";
    return `${prefix}.${JSON.stringify({
      workspaces: workspaces.map((workspace) => workspace.path).sort(),
      excludedDirectories: [...excludedDirectories].sort(),
    })}`;
  },

  isValid: isIndexedNoteArray,
});

export const AttachmentsCache = createCache<IndexedAttachment[], [Workspace[], Set<string>, Set<string>]>({
  key(workspaces, excludedDirectories, excludedExtensions) {
    const prefix = "octarine.attachments.v1";
    return `${prefix}.${JSON.stringify({
      workspaces: workspaces.map((workspace) => workspace.path).sort(),
      excludedDirectories: [...excludedDirectories].sort(),
      excludedExtensions: [...excludedExtensions].sort(),
    })}`;
  },

  isValid: isIndexedAttachmentArray,
});
