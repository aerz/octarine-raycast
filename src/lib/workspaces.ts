import path from "node:path";
import type { IndexedWorkspace } from "../types/workspaces";
import { WorkspacesCache } from "./cache";
import type { ScannedPath } from "./files";
import { scanPaths } from "./files";
import { extensionPreferences } from "./preferences";

function buildIndexedWorkspace({ path: workspacePath, ignored, invalid }: ScannedPath): IndexedWorkspace {
  return {
    name: path.basename(workspacePath),
    path: workspacePath,
    ignored,
    invalid,
  };
}

async function scanWorkspaces(roots: string[], excludedDirectories: Set<string>): Promise<IndexedWorkspace[]> {
  const paths = await scanPaths(roots, excludedDirectories);
  const workspaces = paths.map(buildIndexedWorkspace);

  return [...workspaces].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.path.localeCompare(b.path);
  });
}

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
