import { promises as fs } from "node:fs";
import path from "node:path";
import { Workspace, WorkspaceLoadResult, loadWorkspaces } from "./workspaces";

const VIEWS_FILE_NAME = "views.json";
const OCTARINE_DIRECTORY_NAME = ".octarine";

type RawView = {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
  icon?: unknown;
  color?: unknown;
  order?: unknown;
};

type ValidRawView = RawView & {
  name: string;
};

export type OctarineView = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  workspaceName: string;
  workspacePath: string;
  searchText: string;
};

export type WorkspaceViews = {
  workspace: Workspace;
  views: OctarineView[];
};

export type ViewsScanResult = Pick<WorkspaceLoadResult, "invalidRoots" | "fromCache"> & {
  workspaceCount: number;
  workspaceViews: WorkspaceViews[];
};

function isValidRawView(value: unknown): value is ValidRawView {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rawView = value as RawView;
  return typeof rawView.name === "string" && rawView.name.trim().length > 0;
}

function buildViewSearchText(name: string, description: string | undefined, workspaceName: string): string {
  return `${name} ${description ?? ""} ${workspaceName}`.toLowerCase();
}

function parseViews(rawValue: unknown, workspace: Workspace): OctarineView[] | undefined {
  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  if (rawValue.length === 0) {
    return [];
  }

  if (!rawValue.every(isValidRawView)) {
    return undefined;
  }

  const validViews = rawValue.filter(isValidRawView);
  if (validViews.length !== rawValue.length) {
    return undefined;
  }

  return validViews
    .map((rawView, index) => {
      const viewName = rawView.name.trim();
      const description =
        typeof rawView.desc === "string" && rawView.desc.trim().length > 0 ? rawView.desc.trim() : undefined;

      return {
        id: typeof rawView.id === "string" && rawView.id.trim().length > 0 ? rawView.id : `${workspace.path}::${index}`,
        name: viewName,
        description,
        icon: typeof rawView.icon === "string" && rawView.icon.trim().length > 0 ? rawView.icon : undefined,
        color: typeof rawView.color === "string" && rawView.color.trim().length > 0 ? rawView.color : undefined,
        order: typeof rawView.order === "number" ? rawView.order : undefined,
        workspaceName: workspace.name,
        workspacePath: workspace.path,
        searchText: buildViewSearchText(viewName, description, workspace.name),
      };
    })
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
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
