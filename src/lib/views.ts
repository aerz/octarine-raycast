import { promises as fs } from "node:fs";
import path from "node:path";
import { isWorkspace, type Workspace } from "../types/octarine";
import { type IndexedWorkspace } from "../types/workspaces";
import { loadStoredJson, saveStoredJson } from "./localstorage";
import { buildSearchText } from "./search";
import { isIndexedView, type IndexedView } from "../types/views";
import { getWorkspaces } from "./workspaces";

const OCTARINE_VIEWS_FILE = "views.json";
const OCTARINE_DIRECTORY_NAME = ".octarine";
const VIEWS_CACHE_KEY = "octarine.views.v1";
const VIEWS_CACHE_VERSION = 1;

type RawView = {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
};

export type WorkspaceViews = {
  workspace: Workspace;
  views: IndexedView[];
};

export type ViewsScanResult = {
  workspaceCount: number;
  skippedRootsCount: number;
  workspaceViews: WorkspaceViews[];
};

type ViewsCache = {
  version: number;
  workspaceDiscoverySignature: string;
  scannedAt: string;
  workspaces: Workspace[];
  workspaceViews: WorkspaceViews[];
};

export type ViewsCacheResult = {
  workspaces: Workspace[];
  workspaceViews: WorkspaceViews[];
};

function isWorkspaceViews(value: unknown): value is WorkspaceViews {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeWorkspaceViews = value as Partial<WorkspaceViews>;
  return (
    isWorkspace(maybeWorkspaceViews.workspace) &&
    Array.isArray(maybeWorkspaceViews.views) &&
    maybeWorkspaceViews.views.every(isIndexedView)
  );
}

function isViewsCache(value: unknown): value is ViewsCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeCache = value as Partial<ViewsCache>;
  return (
    maybeCache.version === VIEWS_CACHE_VERSION &&
    typeof maybeCache.workspaceDiscoverySignature === "string" &&
    typeof maybeCache.scannedAt === "string" &&
    Array.isArray(maybeCache.workspaces) &&
    maybeCache.workspaces.every(isWorkspace) &&
    Array.isArray(maybeCache.workspaceViews) &&
    maybeCache.workspaceViews.every(isWorkspaceViews)
  );
}

function parseView(rawValue: unknown, workspace: Workspace, index: number): IndexedView | undefined {
  if (!rawValue || typeof rawValue !== "object") {
    return undefined;
  }

  const rawView = rawValue as RawView;
  if (typeof rawView.name !== "string") {
    return undefined;
  }

  const viewName = rawView.name.trim();
  if (!viewName) {
    return undefined;
  }

  const description = typeof rawView.desc === "string" ? rawView.desc.trim() : "";

  return {
    id: typeof rawView.id === "string" && rawView.id.trim().length > 0 ? rawView.id : `${workspace.path}::${index}`,
    name: viewName,
    description,
    workspace,
    searchText: buildSearchText(viewName, description, workspace.name),
  };
}

function parseViews(rawValue: unknown, workspace: Workspace): IndexedView[] | undefined {
  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  const views: IndexedView[] = [];

  for (const [index, rawView] of rawValue.entries()) {
    const parsedView = parseView(rawView, workspace, index);
    if (!parsedView) {
      return undefined;
    }

    views.push(parsedView);
  }

  return views.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

async function scanWorkspaceViews(workspace: Workspace): Promise<WorkspaceViews | undefined> {
  const viewsPath = path.join(workspace.path, OCTARINE_DIRECTORY_NAME, OCTARINE_VIEWS_FILE);

  let fileContents: string;
  try {
    fileContents = await fs.readFile(viewsPath, "utf8");
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (errorCode === "ENOENT") {
      return undefined;
    }

    console.warn("Skipping unreadable Octarine views file", {
      workspacePath: workspace.path,
      viewsPath,
      error,
    });
    return undefined;
  }

  let parsedContents: unknown;
  try {
    parsedContents = JSON.parse(fileContents) as unknown;
  } catch (error) {
    console.warn("Skipping malformed Octarine views file", {
      workspacePath: workspace.path,
      viewsPath,
      error,
    });
    return undefined;
  }

  const views = parseViews(parsedContents, workspace);
  if (!views) {
    console.warn("Skipping invalid Octarine views file contents", {
      workspacePath: workspace.path,
      viewsPath,
    });
    return undefined;
  }

  if (views.length === 0) {
    return undefined;
  }

  return {
    workspace,
    views,
  };
}

export async function loadCachedViews(workspaceDiscoverySignature: string): Promise<ViewsCacheResult | undefined> {
  const cached = await loadStoredJson(VIEWS_CACHE_KEY, isViewsCache);

  if (!cached || cached.workspaceDiscoverySignature !== workspaceDiscoverySignature) {
    return undefined;
  }

  return {
    workspaces: cached.workspaces,
    workspaceViews: cached.workspaceViews,
  };
}

export async function saveCachedViews(
  workspaces: Workspace[],
  workspaceViews: WorkspaceViews[],
  workspaceDiscoverySignature: string,
): Promise<void> {
  await saveStoredJson(VIEWS_CACHE_KEY, {
    version: VIEWS_CACHE_VERSION,
    workspaceDiscoverySignature,
    scannedAt: new Date().toISOString(),
    workspaces,
    workspaceViews,
  });
}

export async function scanViewsFromWorkspaces(options?: { forceRefresh?: boolean }): Promise<ViewsScanResult> {
  const indexedWorkspaces = await getWorkspaces({ refresh: options?.forceRefresh });
  const workspaces = indexedWorkspaces.filter(
    (workspace): workspace is IndexedWorkspace => !workspace.invalid && !workspace.ignored,
  );
  const workspaceViews = (await Promise.all(workspaces.map((workspace) => scanWorkspaceViews(workspace)))).filter(
    (value): value is WorkspaceViews => value !== undefined,
  );

  return {
    workspaceCount: workspaces.length,
    skippedRootsCount: indexedWorkspaces.filter((workspace) => workspace.invalid).length,
    workspaceViews,
  };
}
