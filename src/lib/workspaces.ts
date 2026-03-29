import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { isWorkspace, type Workspace } from "../types/octarine";
import { loadStoredJson, saveStoredJson } from "./cache";
import { getExtensionPreferences } from "./preferences";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";
const WORKSPACE_MARKER = ".octarine";
const CACHE_VERSION = 3;

type WorkspaceCache = {
  version: number;
  rootsDiscoverySignature: string;
  scannedAt: string;
  workspaces: Workspace[];
};

export type LoadWorkspacesResult = {
  workspaces: Workspace[];
  invalidRoots: string[];
  fromCache: boolean;
};

function isWorkspaceCache(value: unknown): value is WorkspaceCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeCache = value as Partial<WorkspaceCache>;
  return (
    maybeCache.version === CACHE_VERSION &&
    typeof maybeCache.rootsDiscoverySignature === "string" &&
    typeof maybeCache.scannedAt === "string" &&
    Array.isArray(maybeCache.workspaces) &&
    maybeCache.workspaces.every(isWorkspace)
  );
}

async function discoverWorkspacesInRoot(rootPath: string, excludedWorkspaces: Set<string>): Promise<Workspace[]> {
  const discovered: Workspace[] = [];
  const pendingDirectories: string[] = [rootPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasWorkspaceMarker = entries.some((entry) => entry.isDirectory() && entry.name === WORKSPACE_MARKER);
    if (hasWorkspaceMarker) {
      const absoluteWorkspacePath = path.normalize(path.resolve(currentDirectory));
      const workspaceName = path.basename(absoluteWorkspacePath);

      if (excludedWorkspaces.has(workspaceName.toLowerCase())) {
        continue;
      }

      discovered.push({
        name: workspaceName,
        path: absoluteWorkspacePath,
      });
      continue;
    }

    for (const entry of entries) {
      if (entry.name === WORKSPACE_MARKER) {
        continue;
      }

      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue;
      }

      pendingDirectories.push(path.join(currentDirectory, entry.name));
    }
  }

  return discovered;
}

async function discoverWorkspaces(
  roots: string[],
  excludedWorkspaces: Set<string>,
): Promise<{ workspaces: Workspace[]; invalidRoots: string[] }> {
  const rootResults = await Promise.all(
    roots.map(async (rootPath) => {
      try {
        const rootStats = await fs.stat(rootPath);
        if (!rootStats.isDirectory()) {
          return { rootPath, invalid: true, workspaces: [] as Workspace[] };
        }
      } catch {
        return { rootPath, invalid: true, workspaces: [] as Workspace[] };
      }

      const workspaces = await discoverWorkspacesInRoot(rootPath, excludedWorkspaces);
      return { rootPath, invalid: false, workspaces };
    }),
  );

  const invalidRoots: string[] = [];
  const dedupedPaths = new Set<string>();
  const workspaces: Workspace[] = [];

  for (const result of rootResults) {
    if (result.invalid) {
      invalidRoots.push(result.rootPath);
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

export async function loadWorkspaces(options?: { forceRefresh?: boolean }): Promise<LoadWorkspacesResult> {
  const preferences = getExtensionPreferences();
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = await loadStoredJson(WORKSPACES_CACHE_KEY, isWorkspaceCache);
    if (cached && cached.rootsDiscoverySignature === preferences.workspaceDiscoverySignature) {
      return {
        workspaces: cached.workspaces,
        invalidRoots: [],
        fromCache: true,
      };
    }
  }

  const discoveryResult = await discoverWorkspaces(preferences.workspaceRoots, preferences.excludedWorkspaces);
  await saveStoredJson(WORKSPACES_CACHE_KEY, {
    version: CACHE_VERSION,
    rootsDiscoverySignature: preferences.workspaceDiscoverySignature,
    scannedAt: new Date().toISOString(),
    workspaces: discoveryResult.workspaces,
  });

  return {
    workspaces: discoveryResult.workspaces,
    invalidRoots: discoveryResult.invalidRoots,
    fromCache: false,
  };
}
