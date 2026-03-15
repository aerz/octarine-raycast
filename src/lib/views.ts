import { promises as fs } from "node:fs";
import path from "node:path";
import type { View, Workspace } from "../types/octarine";
import { buildSearchIndexText } from "./search";
import { type WorkspaceLoadResult, loadWorkspaces } from "./workspaces";

const VIEWS_FILE_NAME = "views.json";
const OCTARINE_DIRECTORY_NAME = ".octarine";

type RawView = {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
};

export type IndexedView = View & {
  searchText: string;
};

export type WorkspaceViews = {
  workspace: Workspace;
  views: IndexedView[];
};

export type ViewsScanResult = Pick<WorkspaceLoadResult, "invalidRoots" | "fromCache"> & {
  workspaceCount: number;
  workspaceViews: WorkspaceViews[];
};

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
    searchText: buildSearchIndexText(viewName, description, workspace.name),
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

  return views.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

async function scanWorkspaceViews(workspace: Workspace): Promise<WorkspaceViews | undefined> {
  const viewsPath = path.join(workspace.path, OCTARINE_DIRECTORY_NAME, VIEWS_FILE_NAME);

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

export async function scanViewsFromWorkspaces(options?: { forceRefresh?: boolean }): Promise<ViewsScanResult> {
  const workspaceResult = await loadWorkspaces(options);
  const workspaceViews = (
    await Promise.all(workspaceResult.workspaces.map((workspace) => scanWorkspaceViews(workspace)))
  ).filter((value): value is WorkspaceViews => value !== undefined);

  return {
    workspaceCount: workspaceResult.workspaces.length,
    workspaceViews,
    invalidRoots: workspaceResult.invalidRoots,
    fromCache: workspaceResult.fromCache,
  };
}
