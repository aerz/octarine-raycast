import type { Workspace } from "../types/octarine";
import { ViewsCache } from "./cache";
import { readViewsFile } from "./files";
import { buildSearchText } from "./search";
import type { IndexedView } from "../types/views";

type ViewData = {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
};

export async function getViews(workspaces: Workspace[], options?: { refresh?: boolean }): Promise<IndexedView[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = ViewsCache.read(workspaces);
    if (cached) {
      return cached;
    }
  }

  const views = await scanViews(workspaces);
  ViewsCache.write(views, workspaces);
  return views;
}

async function scanViews(workspaces: Workspace[]): Promise<IndexedView[]> {
  const views = await Promise.all(
    workspaces.map(async (workspace) => {
      const data = await readViewsFile(workspace.path);
      if (data === undefined) {
        return [];
      }

      const views = buildIndexedViews(data, workspace);
      return views ?? [];
    }),
  );

  return views.flat();
}

function buildIndexedViews(value: unknown, workspace: Workspace): IndexedView[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const views = value.flatMap((item, index) => {
    const view = buildIndexedView(item, workspace, index);
    return view ? [view] : [];
  });

  if (views.length !== value.length) {
    return undefined;
  }

  return views.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function buildIndexedView(value: unknown, workspace: Workspace, index: number): IndexedView | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value as ViewData;
  if (typeof item.name !== "string") {
    return undefined;
  }

  const name = item.name.trim();
  if (!name) {
    return undefined;
  }

  const description = typeof item.desc === "string" ? item.desc.trim() : "";

  return {
    id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id : `${workspace.path}::${index}`,
    name,
    description,
    workspace,
    searchText: buildSearchText(name, description, workspace.name),
  };
}
