import { Cache } from "@raycast/api";
import { isWorkspace, type Workspace } from "../types/octarine";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";
const WORKSPACES_CACHE_TTL = 15 * 60 * 1000;

const cache = new Cache();

type WorkspacesCache = {
  cachedAt: number;
  workspaces: Workspace[];
};

function isWorkspacesCache(value: unknown): value is WorkspacesCache {
  const v = value as WorkspacesCache;
  return typeof v?.cachedAt === "number" && Array.isArray(v?.workspaces) && v.workspaces.every(isWorkspace);
}

function sortWorkspaceRoots(workspaceRoots: string[]): string[] {
  return [...workspaceRoots].sort();
}

function workspaceRootsKey(workspaceRoots: string[]): string {
  return `${WORKSPACES_CACHE_KEY}.${JSON.stringify(sortWorkspaceRoots(workspaceRoots))}`;
}

export function getWorkspacesCache(workspaceRoots: string[]): Workspace[] | undefined {
  const value = cache.get(workspaceRootsKey(workspaceRoots));
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isWorkspacesCache(parsed)) {
      return undefined;
    }

    return Date.now() - parsed.cachedAt <= WORKSPACES_CACHE_TTL ? parsed.workspaces : undefined;
  } catch {
    return undefined;
  }
}

export function setWorkspacesCache(workspaces: Workspace[], workspaceRoots: string[]): void {
  cache.set(
    workspaceRootsKey(workspaceRoots),
    JSON.stringify({
      cachedAt: Date.now(),
      workspaces,
    }),
  );
}
