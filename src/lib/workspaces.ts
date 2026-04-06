import path from "node:path";
import type { Workspace } from "../types/octarine";
import { getWorkspacesCache, setWorkspacesCache } from "./cache";
import { scanWorkspacePaths } from "./files";
import { extensionPreferences } from "./preferences";

export type ScanWorkspacesResult = {
  workspaces: Workspace[];
  invalidRoots: string[];
};

async function scanWorkspaces(roots: string[], excludedWorkspaces: Set<string>): Promise<ScanWorkspacesResult> {
  const { paths, invalidRoots } = await scanWorkspacePaths(roots, excludedWorkspaces);
  const workspaces = paths.map((workspacePath) => ({
    name: path.basename(workspacePath),
    path: workspacePath,
  }));

  workspaces.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.path.localeCompare(b.path);
  });

  return { workspaces, invalidRoots };
}

export async function loadWorkspaces(options?: { refresh?: boolean }): Promise<ScanWorkspacesResult> {
  const { workspaceRoots, excludedWorkspaces } = extensionPreferences();
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cache = getWorkspacesCache(workspaceRoots);
    if (cache) {
      return {
        workspaces: cache.workspaces,
        invalidRoots: cache.invalidRoots,
      };
    }
  }

  const { workspaces, invalidRoots } = await scanWorkspaces(workspaceRoots, excludedWorkspaces);
  setWorkspacesCache(workspaces, workspaceRoots, invalidRoots);

  return {
    workspaces,
    invalidRoots,
  };
}
