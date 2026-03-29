import { Cache } from "@raycast/api";
import { isWorkspace, type Workspace } from "../types/octarine";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";

const cache = new Cache();

function isWorkspacesCache(value: unknown): value is Workspace[] {
  return Array.isArray(value) && value.every(isWorkspace);
}

export function getWorkspacesCache(): Workspace[] | undefined {
  const value = cache.get(WORKSPACES_CACHE_KEY);
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isWorkspacesCache(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function setWorkspacesCache(workspaces: Workspace[]): void {
  cache.set(WORKSPACES_CACHE_KEY, JSON.stringify(workspaces));
}
