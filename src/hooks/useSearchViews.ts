import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { skippedRootsToast, viewsLoadToast } from "../components/Toasts";
import { matchesSearchIndex } from "../lib/search";
import { type IndexedView, type ViewsScanResult, scanViewsFromWorkspaces } from "../lib/views";

export type WorkspaceViewSection = {
  workspaceName: string;
  views: IndexedView[];
};

type SearchState =
  | "loading"
  | "noConfiguredWorkspaces"
  | "noAvailableViews"
  | "noMatchingViews"
  | "showByWorkspace"
  | "showFlat";

type Options = {
  searchText: string;
  selectedWorkspace: string;
  workspaceDiscoverySignature: string;
  hasConfiguredRoots: boolean;
};

type Result = {
  workspaceNames: string[];
  matchingViews: IndexedView[];
  sections: WorkspaceViewSection[];
  searchState: SearchState;
};

export function useSearchViews({
  searchText,
  selectedWorkspace,
  workspaceDiscoverySignature,
  hasConfiguredRoots,
}: Options): Result {
  const {
    data: scanResult,
    error,
    isLoading,
  } = useCachedPromise(
    async (workspaceDiscoverySignature: string): Promise<ViewsScanResult> => {
      // workspaceDiscoverySignature is used as a cache key only; changes trigger a re-fetch.
      void workspaceDiscoverySignature;
      return scanViewsFromWorkspaces();
    },
    [workspaceDiscoverySignature],
    {
      execute: hasConfiguredRoots,
      onData: async (result) => {
        if (!result.fromCache && result.invalidRoots.length > 0) {
          await skippedRootsToast(result.invalidRoots.length);
        }
      },
      onError: async (error) => {
        console.error("Failed to scan Octarine views", error);
        await viewsLoadToast();
      },
    },
  );

  const workspaceNames = useMemo(
    () => scanResult?.workspaceViews.map((entry) => entry.workspace.name) ?? [],
    [scanResult],
  );
  const hasValidWorkspaces = (scanResult?.workspaceCount ?? 0) > 0;

  const { availableViewCount, matchingViews, sections } = useMemo(() => {
    const workspaceViews = scanResult?.workspaceViews ?? [];
    const matchingViews: IndexedView[] = [];
    const sections: WorkspaceViewSection[] = [];
    let availableViewCount = 0;

    for (const entry of workspaceViews) {
      const matchesWorkspace = selectedWorkspace === "all" || entry.workspace.name === selectedWorkspace;
      if (!matchesWorkspace) {
        continue;
      }

      availableViewCount += entry.views.length;

      const workspaceMatchingViews = entry.views.filter((view) => matchesSearchIndex(view.searchText, searchText));
      if (workspaceMatchingViews.length === 0) {
        continue;
      }

      matchingViews.push(...workspaceMatchingViews);
      sections.push({
        workspaceName: entry.workspace.name,
        views: workspaceMatchingViews,
      });
    }

    return { availableViewCount, matchingViews, sections };
  }, [scanResult, searchText, selectedWorkspace]);

  const searchState = getSearchState({
    isLoading,
    error: error instanceof Error ? error : undefined,
    hasConfiguredRoots,
    hasValidWorkspaces,
    availableViewCount,
    matchedViewCount: matchingViews.length,
    selectedWorkspace,
  });

  return {
    workspaceNames,
    matchingViews,
    sections,
    searchState,
  };
}

function getSearchState({
  isLoading,
  error,
  hasConfiguredRoots,
  hasValidWorkspaces,
  availableViewCount,
  matchedViewCount,
  selectedWorkspace,
}: {
  isLoading: boolean;
  error: Error | undefined;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  availableViewCount: number;
  matchedViewCount: number;
  selectedWorkspace: string;
}): SearchState {
  if (isLoading && availableViewCount === 0) {
    return "loading";
  }

  if (error || !hasConfiguredRoots || !hasValidWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (availableViewCount === 0) {
    return "noAvailableViews";
  }

  if (matchedViewCount === 0) {
    return "noMatchingViews";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}
