import { useMemo } from "react";
import { useNotes } from "./useNotes";
import { buildDailyDeskItems, isDailyDeskItem, type DailyDeskItem } from "../lib/daily-desk";
import { type IndexedNote } from "../lib/notes";

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
  excludedFolders: Set<string>;
  workspacesSignature: string;
  hasWorkspaces: boolean;
};

type Result = {
  workspaces: string[];
  items: QuickCaptureItem[];
  workspaceItems: Map<string, QuickCaptureItem[]>;
  searchState: SearchState;
  isLoading: boolean;
};

export function useQuickCapture({
  search,
  workspace,
  excludedFolders,
  workspacesSignature,
  hasWorkspaces,
}: Options): Result {
  const {
    workspaceNames: workspaces,
    matchingNotes,
    searchState: notesSearchState,
    isLoading,
  } = useNotes({
    searchText: search,
    selectedWorkspace: workspace,
    excludedDirectoryNames: excludedFolders,
    workspaceSearchSignature: workspacesSignature,
    hasConfiguredRoots: hasWorkspaces,
    showPinnedNotesFirst: false,
  });

  const searchableItems = useMemo(
    () => [...matchingNotes, ...buildDailyDeskItems(workspaces, search)],
    [matchingNotes, search, workspaces],
  );
  const items = useMemo(
    () =>
      searchableItems.filter(
        (item) => workspace === "all" || (isDailyDeskItem(item) ? item.workspace : item.workspace.name) === workspace,
      ),
    [searchableItems, workspace],
  );
  const workspaceItems = useMemo(() => groupItemsByWorkspace(items), [items]);
  const showQuickCapture = search.trim().length === 0;
  const searchState = getSearchState({
    filteredItemCount: items.length,
    isLoading,
    searchState: notesSearchState,
    workspace,
    showQuickCapture,
  });

  return {
    workspaces,
    items,
    workspaceItems,
    searchState,
    isLoading,
  };
}

function getSearchState({
  filteredItemCount,
  isLoading,
  searchState,
  workspace,
  showQuickCapture,
}: {
  filteredItemCount: number;
  isLoading: boolean;
  searchState:
    | "loading"
    | "noConfiguredWorkspaces"
    | "noAvailableNotes"
    | "noMatchingNotes"
    | "showByWorkspace"
    | "showFlat";
  workspace: string;
  showQuickCapture: boolean;
}): SearchState {
  if (searchState === "noConfiguredWorkspaces") {
    return "noConfiguredWorkspaces";
  }

  if (showQuickCapture && searchState === "noAvailableNotes") {
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
    const workspace = isDailyDeskItem(item) ? item.workspace : item.workspace.name;
    const workspaceItems = result.get(workspace);

    if (workspaceItems) {
      workspaceItems.push(item);
    } else {
      result.set(workspace, [item]);
    }
  }

  return result;
}
