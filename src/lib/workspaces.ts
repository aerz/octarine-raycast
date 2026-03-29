import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import type { Workspace } from "../types/octarine";
import { getWorkspacesCache, setWorkspacesCache } from "./cache";
import { getExtensionPreferences } from "./preferences";

const WORKSPACE_DIR_NAME = ".octarine";

type ScanWorkspacesResult = {
  workspaces: Workspace[];
  invalidRoots: string[];
};

export type LoadWorkspacesResult = ScanWorkspacesResult & {
  cached: boolean;
};

async function scanWorkspacesRoot(root: string, excludedWorkspaces: Set<string>): Promise<Workspace[]> {
  const discovered: Workspace[] = [];
  const walk = async (current: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    const isOctarineWorkspace = entries.some((entry) => entry.isDirectory() && entry.name === WORKSPACE_DIR_NAME);
    if (isOctarineWorkspace) {
      const workspacePath = path.normalize(path.resolve(current));
      const workspaceName = path.basename(workspacePath);

      if (excludedWorkspaces.has(workspaceName.toLowerCase())) {
        return;
      }

      discovered.push({
        name: workspaceName,
        path: workspacePath,
      });
      return;
    }

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && entry.name !== WORKSPACE_DIR_NAME)
        .map((entry) => walk(path.join(current, entry.name))),
    );
  };

  return walk(root).then(() => discovered);
}

async function scanWorkspaces(roots: string[], excludedWorkspaces: Set<string>): Promise<ScanWorkspacesResult> {
  const results = await Promise.all(
    roots.map(async (path) => {
      try {
        const stat = await fs.stat(path);
        if (!stat.isDirectory()) {
          return { path, invalid: true, workspaces: [] as Workspace[] };
        }
      } catch {
        return { path, invalid: true, workspaces: [] as Workspace[] };
      }

      const workspaces = await scanWorkspacesRoot(path, excludedWorkspaces);
      return { path, invalid: false, workspaces };
    }),
  );

  const invalidRoots: string[] = [];
  const dedupedPaths = new Set<string>();
  const workspaces: Workspace[] = [];

  for (const result of results) {
    if (result.invalid) {
      invalidRoots.push(result.path);
      continue;
    }

    for (const workspace of result.workspaces) {
      if (dedupedPaths.has(workspace.path)) {
        continue;
      }

      dedupedPaths.add(workspace.path);
      workspaces.push(workspace);
    }
  }

  workspaces.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.path.localeCompare(b.path);
  });

  return { workspaces, invalidRoots };
}

export async function loadWorkspaces(options?: { refresh?: boolean }): Promise<LoadWorkspacesResult> {
  const { workspaceRoots, excludedWorkspaces } = getExtensionPreferences();
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cache = getWorkspacesCache();
    if (cache) {
      return {
        workspaces: cache,
        invalidRoots: [],
        cached: true,
      };
    }
  }

  const scan = await scanWorkspaces(workspaceRoots, excludedWorkspaces);
  setWorkspacesCache(scan.workspaces);

  return {
    workspaces: scan.workspaces,
    invalidRoots: scan.invalidRoots,
    cached: false,
  };
}
