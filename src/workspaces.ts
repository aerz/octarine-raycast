import { LocalStorage, getPreferenceValues } from "@raycast/api";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";
const WORKSPACE_MARKER = ".octarine";
const CACHE_VERSION = 1;

export type Workspace = {
  name: string;
  path: string;
};

type WorkspaceCache = {
  version: number;
  rootsSignature: string;
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

function computeRootsSignature(roots: string[]): string {
  return [...roots].sort().join("|");
}

function isWorkspaceCache(value: unknown): value is WorkspaceCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeCache = value as Partial<WorkspaceCache>;
  return (
    maybeCache.version === CACHE_VERSION &&
    typeof maybeCache.rootsSignature === "string" &&
    typeof maybeCache.scannedAt === "string" &&
    Array.isArray(maybeCache.workspaces) &&
    maybeCache.workspaces.every(
      (workspace) =>
        workspace &&
        typeof workspace === "object" &&
        typeof workspace.name === "string" &&
        typeof workspace.path === "string",
    )
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

async function discoverWorkspacesInRoot(rootPath: string, dedupedPaths: Set<string>): Promise<Workspace[]> {
  const discovered: Workspace[] = [];
  const pendingDirectories: string[] = [rootPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
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
      if (!dedupedPaths.has(absoluteWorkspacePath)) {
        dedupedPaths.add(absoluteWorkspacePath);
        discovered.push({
          name: path.basename(absoluteWorkspacePath),
          path: absoluteWorkspacePath,
        });
      }
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

async function discoverWorkspaces(roots: string[]): Promise<{ workspaces: Workspace[]; invalidRoots: string[] }> {
  const invalidRoots: string[] = [];
  const dedupedPaths = new Set<string>();
  const workspaces: Workspace[] = [];

  for (const rootPath of roots) {
    try {
      const rootStats = await fs.stat(rootPath);
      if (!rootStats.isDirectory()) {
        invalidRoots.push(rootPath);
        continue;
      }
    } catch {
      invalidRoots.push(rootPath);
      continue;
    }

    const discoveredInRoot = await discoverWorkspacesInRoot(rootPath, dedupedPaths);
    workspaces.push(...discoveredInRoot);
  }

  workspaces.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.path.localeCompare(b.path);
  });

  return { workspaces, invalidRoots };
}

export async function loadWorkspaces(options?: { forceRefresh?: boolean }): Promise<WorkspaceLoadResult> {
  const preferences = getPreferenceValues<Preferences.OpenWorkspace>();
  const roots = parseWorkspaceRoots(preferences.workspaceRoots);
  const rootsSignature = computeRootsSignature(roots);
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = await loadCache();
    if (cached && cached.rootsSignature === rootsSignature) {
      return {
        workspaces: cached.workspaces,
        invalidRoots: [],
        fromCache: true,
      };
    }
  }

  const discoveryResult = await discoverWorkspaces(roots);
  await saveCache({
    version: CACHE_VERSION,
    rootsSignature,
    scannedAt: new Date().toISOString(),
    workspaces: discoveryResult.workspaces,
  });

  return {
    workspaces: discoveryResult.workspaces,
    invalidRoots: discoveryResult.invalidRoots,
    fromCache: false,
  };
}
