import path from "node:path";
import type { IndexedWorkspace } from "@type/workspaces";
import type { Workspace } from "@type/octarine";
import { WorkspacesCache } from "@lib/cache";
import type { ScannedPath } from "@lib/files";
import { scanPaths } from "@lib/files";
import { extensionPreferences } from "@lib/preferences";
import { normalizeText } from "@lib/utils";

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
 *
 * @remarks
 * The result includes invalid and ignored entries. Callers can use these flags to filter
 * the workspace list.
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
