import { LocalStorage, getPreferenceValues } from "@raycast/api";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isWorkspace, type Workspace } from "../types/octarine";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";
const WORKSPACE_MARKER = ".octarine";
const CACHE_VERSION = 2;

type WorkspaceCache = {
  version: number;
  rootsDiscoverySignature: string;
  scannedAt: string;
  workspaces: Workspace[];
};

export type WorkspaceLoadResult = {
  workspaces: Workspace[];
  invalidRoots: string[];
  fromCache: boolean;
};

function expandTilde(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function parseWorkspaceRoots(rawValue: string): string[] {
  const dedupedRoots = new Set<string>();

  for (const part of rawValue.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const expanded = expandTilde(trimmed);
    const absolute = path.resolve(expanded);
    dedupedRoots.add(path.normalize(absolute));
  }

  return Array.from(dedupedRoots);
}

function parseExcludedFolders(rawValue?: string): Set<string> {
  const dedupedFolders = new Set<string>();

  if (!rawValue) {
    return dedupedFolders;
  }

  for (const part of rawValue.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (!trimmed) {
      continue;
    }

    dedupedFolders.add(trimmed);
  }

  return dedupedFolders;
}

function computeRootsDiscoverySignature(roots: string[], excludedFolders: Set<string>): string {
  const rootsSignature = [...roots].sort().join("|");
  const excludedFoldersSignature = [...excludedFolders].sort().join("|");
  return `${rootsSignature}::${excludedFoldersSignature}`;
}

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

async function loadCache(): Promise<WorkspaceCache | undefined> {
  const cachedValue = await LocalStorage.getItem<string>(WORKSPACES_CACHE_KEY);
  if (!cachedValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isWorkspaceCache(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveCache(cache: WorkspaceCache): Promise<void> {
  await LocalStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(cache));
}

async function discoverWorkspacesInRoot(rootPath: string, excludedFolders: Set<string>): Promise<Workspace[]> {
  const discovered: Workspace[] = [];
  const pendingDirectories: string[] = [rootPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    if (excludedFolders.has(path.basename(currentDirectory).toLowerCase())) {
      continue;
    }

    let entries;
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasWorkspaceMarker = entries.some((entry) => entry.isDirectory() && entry.name === WORKSPACE_MARKER);
    if (hasWorkspaceMarker) {
      const absoluteWorkspacePath = path.normalize(path.resolve(currentDirectory));
      discovered.push({
        name: path.basename(absoluteWorkspacePath),
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

      if (excludedFolders.has(entry.name.toLowerCase())) {
        continue;
      }

      pendingDirectories.push(path.join(currentDirectory, entry.name));
    }
  }

  return discovered;
}

async function discoverWorkspaces(
  roots: string[],
  excludedFolders: Set<string>,
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

      const workspaces = await discoverWorkspacesInRoot(rootPath, excludedFolders);
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

export async function loadWorkspaces(options?: { forceRefresh?: boolean }): Promise<WorkspaceLoadResult> {
  const preferences = getPreferenceValues<{ workspaceRoots: string; excludedFolders?: string }>();
  const roots = parseWorkspaceRoots(preferences.workspaceRoots);
  const excludedFolders = parseExcludedFolders(preferences.excludedFolders);
  const rootsDiscoverySignature = computeRootsDiscoverySignature(roots, excludedFolders);
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = await loadCache();
    if (cached && cached.rootsDiscoverySignature === rootsDiscoverySignature) {
      return {
        workspaces: cached.workspaces,
        invalidRoots: [],
        fromCache: true,
      };
    }
  }

  const discoveryResult = await discoverWorkspaces(roots, excludedFolders);
  await saveCache({
    version: CACHE_VERSION,
    rootsDiscoverySignature,
    scannedAt: new Date().toISOString(),
    workspaces: discoveryResult.workspaces,
  });

  return {
    workspaces: discoveryResult.workspaces,
    invalidRoots: discoveryResult.invalidRoots,
    fromCache: false,
  };
}
