import { Cache } from "@raycast/api";
import { isWorkspace, type Workspace } from "../types/octarine";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";

const cache = new Cache();

function isWorkspacesCache(value: unknown): value is Workspace[] {
  return Array.isArray(value) && value.every(isWorkspace);
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
    const parsed = JSON.parse(value);
    return isWorkspacesCache(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function setWorkspacesCache(workspaces: Workspace[], workspaceRoots: string[]): void {
  cache.set(workspaceRootsKey(sortWorkspaceRoots(workspaceRoots)), JSON.stringify(workspaces));
}
