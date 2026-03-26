import { useMemo } from "react";
import { useNotes } from "./useNotes";
import { type IndexedNote } from "../lib/notes";
import { matchQueryPrefix } from "../lib/search";

export type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  title: string;
  workspace: string;
};

export type QuickCaptureItem = IndexedNote | DailyDeskItem;

export type QuickCaptureRenderState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat"
  | "showByWorkspaceWithQuickCapture"
  | "showFlatWithQuickCapture";

type Options = {
  searchText: string;
  selectedWorkspace: string;
  excludedDirectoryNames: Set<string>;
  workspaceSearchSignature: string;
  hasConfiguredRoots: boolean;
};

type Result = {
  workspaceNames: string[];
  filteredItems: QuickCaptureItem[];
  itemsByWorkspace: Map<string, QuickCaptureItem[]>;
  renderState: QuickCaptureRenderState;
  isLoading: boolean;
};

export function useQuickCapture({
  searchText,
  selectedWorkspace,
  excludedDirectoryNames,
  workspaceSearchSignature,
  hasConfiguredRoots,
}: Options): Result {
  const { workspaceNames, matchingNotes, searchState, isLoading } = useNotes({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames,
    workspaceSearchSignature,
    hasConfiguredRoots,
    showPinnedNotesFirst: false,
  });

  const searchableItems = useMemo(
    () => [...matchingNotes, ...buildDailyDeskItems(workspaceNames, searchText)],
    [matchingNotes, searchText, workspaceNames],
  );
  const filteredItems = useMemo(
    () =>
      searchableItems.filter(
        (item) =>
          selectedWorkspace === "all" || (isDailyDeskItem(item) ? item.workspace : item.workspace.name) === selectedWorkspace,
      ),
    [searchableItems, selectedWorkspace],
  );
  const itemsByWorkspace = useMemo(() => groupItemsByWorkspace(filteredItems), [filteredItems]);
  const showStaticActions = searchText.trim().length === 0;
  const renderState = getQuickCaptureRenderState({
    filteredItemCount: filteredItems.length,
    isLoading,
    searchState,
    selectedWorkspace,
    showStaticActions,
  });

  return {
    workspaceNames,
    filteredItems,
    itemsByWorkspace,
    renderState,
    isLoading,
  };
}

export function buildDailyDeskItems(workspaces: string[], text: string): DailyDeskItem[] {
  const search = text.trim();

  if (!search) {
    return [];
  }

  const match = matchQueryPrefix(workspaces, search);
  if (match) {
    return match.matches.map((workspace) => ({
      date: match.remainder,
      id: `daily-desk::${workspace}::${match.remainder}`,
      kind: "daily-desk",
      title: `Use "${match.remainder}" in Daily Desk`,
      workspace,
    }));
  }

  return workspaces.map((workspace) => ({
    date: search,
    id: `daily-desk::${workspace}::${search}`,
    kind: "daily-desk",
    title: `Use "${search}" in Daily Desk`,
    workspace,
  }));
}

function getQuickCaptureRenderState({
  filteredItemCount,
  isLoading,
  searchState,
  selectedWorkspace,
  showStaticActions,
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
  selectedWorkspace: string;
  showStaticActions: boolean;
}): QuickCaptureRenderState {
  if (searchState === "noConfiguredWorkspaces") {
    return "noConfiguredWorkspaces";
  }

  if (showStaticActions && searchState === "noAvailableNotes") {
    return "noAvailableNotes";
  }

  if (!showStaticActions && !isLoading && filteredItemCount === 0) {
    return "noMatchingNotes";
  }

  if (showStaticActions && selectedWorkspace === "all") {
    return "showByWorkspaceWithQuickCapture";
  }

  if (showStaticActions) {
    return "showFlatWithQuickCapture";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function isDailyDeskItem(item: QuickCaptureItem): item is DailyDeskItem {
  return "kind" in item && item.kind === "daily-desk";
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
