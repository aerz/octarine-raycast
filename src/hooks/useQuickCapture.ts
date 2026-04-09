import { useMemo } from "react";
import { useNotes } from "./useNotes";
import { useWorkspaces } from "./useWorkspaces";
import { buildDailyDeskItems, isDailyDeskItem, type DailyDeskItem } from "../lib/daily-desk";
import { type IndexedNote } from "../types/notes";

export type QuickCaptureItem = IndexedNote | DailyDeskItem;

export type SearchState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat"
  | "showByWorkspaceWithQuickCapture"
  | "showFlatWithQuickCapture";

type Options = {
  search: string;
  workspace: string;
};

type Result = {
  workspaces: string[];
  items: QuickCaptureItem[];
  workspaceItems: Map<string, QuickCaptureItem[]>;
  searchState: SearchState;
  isLoading: boolean;
};

export function useQuickCapture({ search, workspace }: Options): Result {
  const { workspaces: availableWorkspaces, status } = useWorkspaces();
  const { dropdown: workspaces, sections, isLoading } = useNotes({
    workspaces: availableWorkspaces,
    searchText: search,
    selectedWorkspace: workspace,
    showPinnedNotesFirst: false,
  });
  const matchingNotes = useMemo(() => sections.flatMap((section) => section.notes), [sections]);

  const searchableItems = useMemo(
    () => [...matchingNotes, ...buildDailyDeskItems(workspaces, search)],
    [matchingNotes, search, workspaces],
  );
  const items = useMemo(
    () =>
      searchableItems.filter(
        (item) =>
          workspace === "all" || (isDailyDeskItem(item) ? item.workspace : item.folder.workspace.name) === workspace,
      ),
    [searchableItems, workspace],
  );
  const workspaceItems = useMemo(() => groupItemsByWorkspace(items), [items]);
  const showQuickCapture = search.trim().length === 0;
  const searchState = getSearchState({
    filteredItemCount: items.length,
    hasWorkspaces: availableWorkspaces.length > 0,
    isLoading: status.isLoading || isLoading,
    noteCount: matchingNotes.length,
    workspace,
    showQuickCapture,
  });

  return {
    workspaces,
    items,
    workspaceItems,
    searchState,
    isLoading: status.isLoading || isLoading,
  };
}

function getSearchState({
  filteredItemCount,
  hasWorkspaces,
  isLoading,
  noteCount,
  workspace,
  showQuickCapture,
}: {
  filteredItemCount: number;
  hasWorkspaces: boolean;
  isLoading: boolean;
  noteCount: number;
  workspace: string;
  showQuickCapture: boolean;
}): SearchState {
  if (!isLoading && !hasWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (showQuickCapture && !isLoading && noteCount === 0) {
    return "noAvailableNotes";
  }

  if (!showQuickCapture && !isLoading && filteredItemCount === 0) {
    return "noMatchingNotes";
  }

  if (showQuickCapture && workspace === "all") {
    return "showByWorkspaceWithQuickCapture";
  }

  if (showQuickCapture) {
    return "showFlatWithQuickCapture";
  }

  if (workspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function groupItemsByWorkspace(items: QuickCaptureItem[]): Map<string, QuickCaptureItem[]> {
  const result = new Map<string, QuickCaptureItem[]>();

  for (const item of items) {
    const workspace = isDailyDeskItem(item) ? item.workspace : item.folder.workspace.name;
    const workspaceItems = result.get(workspace);

    if (workspaceItems) {
      workspaceItems.push(item);
    } else {
      result.set(workspace, [item]);
    }
  }

  return result;
}
