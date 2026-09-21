import path from "node:path";
import { LocalStorage } from "@raycast/api";
import type { IndexedWorkspace } from "../types/workspaces";
import type { Workspace } from "../types/octarine";
import { WorkspacesCache } from "./cache";
import type { ScannedPath } from "./files";
import { scanPaths } from "./files";
import { extensionPreferences } from "./preferences";
import { normalizeText } from "./utils";

const LAST_WORKSPACE_KEY = "octarine.last-workspace.v1";

/**
 * Finds an indexed workspace by name, ignoring case and surrounding whitespace.
 *
 * @param workspaces Workspaces to search, as returned by `getWorkspaces`.
 * @param name Workspace name to match.
 */
export function findWorkspaceByName(workspaces: Workspace[], name: string): Workspace | undefined {
  const normalized = normalizeText(name);
  if (!normalized) {
    return undefined;
  }

  return workspaces.find((workspace) => normalizeText(workspace.name) === normalized);
}

/**
 * Indexes the workspaces found under the configured root paths.
 *
 * Reads the discovery cache while it matches the current preferences; otherwise scans the
 * roots and rewrites the cache.
 *
 * @param options.refresh Forces a new scan and cache write.
 */
export async function getWorkspaces(options?: { refresh?: boolean }): Promise<IndexedWorkspace[]> {
  const { workspaceRoots, excludedWorkspaces: excludedDirectories } = extensionPreferences();
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cache = WorkspacesCache.read(workspaceRoots, excludedDirectories);
    if (cache) {
      return cache;
    }
  }

  const workspaces = await scanWorkspaces(workspaceRoots, excludedDirectories);
  WorkspacesCache.write(workspaces, workspaceRoots, excludedDirectories);
  return workspaces;
}

/**
 * Reads the last workspace name persisted in Raycast LocalStorage.
 *
 * Only the name is stored; resolve it against indexed workspaces with `resolveLastWorkspace`.
 */
export async function getLastWorkspace(): Promise<string | undefined> {
  const value = await LocalStorage.getItem<string>(LAST_WORKSPACE_KEY);
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Persists a workspace name as the last used one.
 *
 * @param workspaceName Workspace name to remember.
 */
export async function saveLastWorkspace(workspaceName: string): Promise<void> {
  await LocalStorage.setItem(LAST_WORKSPACE_KEY, workspaceName);
}

/**
 * Removes the persisted last workspace name.
 */
export async function clearLastWorkspace(): Promise<void> {
  await LocalStorage.removeItem(LAST_WORKSPACE_KEY);
}

/**
 * Resolves a persisted workspace name against indexed workspaces.
 *
 * @param workspaces Workspaces to search, as returned by `getWorkspaces`.
 * @param storedName Name read from Raycast LocalStorage, if any.
 */
export function resolveLastWorkspace(workspaces: Workspace[], storedName: string | undefined): Workspace | undefined {
  return storedName ? findWorkspaceByName(workspaces, storedName) : undefined;
}

async function scanWorkspaces(roots: string[], excludedDirectories: Set<string>): Promise<IndexedWorkspace[]> {
  const paths = await scanPaths(roots, excludedDirectories);
  const workspaces = paths.map(buildIndexedWorkspace);

  return [...workspaces].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.path.localeCompare(b.path);
  });
}

function buildIndexedWorkspace({ path: workspacePath, ignored, invalid }: ScannedPath): IndexedWorkspace {
  return {
    name: path.basename(workspacePath),
    path: workspacePath,
    ignored,
    invalid,
  };
}
