import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { viewsLoadToast } from "../components/toasts";
import { querySearchText } from "../lib/search";
import { getViews } from "../lib/views";
import type { Workspace } from "../types/octarine";
import type { IndexedView } from "../types/views";

export type WorkspaceViewSection = {
  workspace: string;
  views: IndexedView[];
};

type Options = {
  workspaces: Workspace[];
  isWorkspacesLoading?: boolean;
  searchText: string;
  selectedWorkspace: string;
  refresh?: boolean;
};

type Result = {
  dropdown: string[];
  sections: WorkspaceViewSection[];
  isLoading: boolean;
  revalidate: () => void;
};

export function useViews({
  workspaces,
  isWorkspacesLoading = false,
  searchText,
  selectedWorkspace,
  refresh = false,
}: Options): Result {
  const enabled = !isWorkspacesLoading;
  const { data: views, isLoading, revalidate } = useCachedPromise(
    (refresh: boolean, workspaces: Workspace[]) => getViews(workspaces, { refresh }),
    [refresh, workspaces],
    {
      execute: enabled,
      initialData: [] satisfies IndexedView[],
      keepPreviousData: true,
      onError: async (error) => {
        console.error("Failed to scan Octarine views", error);
        await viewsLoadToast();
      },
      onData: () => {
        if (refresh) {
          showToast({
            style: Toast.Style.Success,
            title: "Views refreshed",
          });
        }
      },
    },
  );

  const { dropdown, sections } = useMemo(() => {
    const grouped = groupByWorkspace(views);

    return {
      dropdown: workspaceNames(grouped),
      sections: buildWorkspaceSections(grouped, { selectedWorkspace, searchText }),
    };
  }, [views, searchText, selectedWorkspace]);

  return {
    dropdown,
    sections,
    isLoading: !enabled || isLoading,
    revalidate,
  };
}

function groupByWorkspace(views: IndexedView[]): WorkspaceViewSection[] {
  const grouped = new Map<string, WorkspaceViewSection>();

  for (const view of views) {
    const section = grouped.get(view.workspace.path);

    if (section) {
      section.views.push(view);
    } else {
      grouped.set(view.workspace.path, {
        workspace: view.workspace.name,
        views: [view],
      });
    }
  }

  return Array.from(grouped.values());
}

function workspaceNames(sections: WorkspaceViewSection[]): string[] {
  return Array.from(new Set(sections.map((section) => section.workspace)));
}

function buildWorkspaceSections(
  sections: WorkspaceViewSection[],
  {
    selectedWorkspace,
    searchText,
  }: {
    selectedWorkspace: string;
    searchText: string;
  },
): WorkspaceViewSection[] {
  return sections
    .filter((section) => selectedWorkspace === "all" || section.workspace === selectedWorkspace)
    .map((section) => ({
      workspace: section.workspace,
      views: searchText ? section.views.filter((view) => querySearchText(view, searchText)) : section.views,
    }))
    .filter((section) => section.views.length > 0);
}
