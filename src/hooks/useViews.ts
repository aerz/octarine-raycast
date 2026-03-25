import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { skippedRootsToast, viewsLoadToast } from "../components/Toasts";
import { matchesSearchIndex } from "../lib/search";
import { type IndexedView, type ViewsScanResult, scanViewsFromWorkspaces } from "../lib/views";

export type ViewSection = {
  workspaceName: string;
  views: IndexedView[];
};

type Options = {
  searchText: string;
  selectedWorkspace: string;
  workspaceDiscoverySignature: string;
  hasConfiguredRoots: boolean;
};

type Result = {
  workspaceNames: string[];
  visibleViews: IndexedView[];
  sections: ViewSection[];
  isLoading: boolean;
  error: Error | undefined;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  totalViewCount: number;
};

export function useViews({
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

  const { totalViewCount, visibleViews, sections } = useMemo(() => {
    const workspaceViews = scanResult?.workspaceViews ?? [];
    const visibleViews: IndexedView[] = [];
    const sections: ViewSection[] = [];
    let totalViewCount = 0;

    for (const entry of workspaceViews) {
      totalViewCount += entry.views.length;

      const matchesWorkspace = selectedWorkspace === "all" || entry.workspace.name === selectedWorkspace;
      if (!matchesWorkspace) {
        continue;
      }

      const matchingViews = entry.views.filter((view) => matchesSearchIndex(view.searchText, searchText));
      if (matchingViews.length === 0) {
        continue;
      }

      visibleViews.push(...matchingViews);
      sections.push({
        workspaceName: entry.workspace.name,
        views: matchingViews,
      });
    }

    return { totalViewCount, visibleViews, sections };
  }, [scanResult, searchText, selectedWorkspace]);

  return {
    workspaceNames,
    visibleViews,
    sections,
    isLoading,
    error: error instanceof Error ? error : undefined,
    hasConfiguredRoots,
    hasValidWorkspaces,
    totalViewCount,
  };
}
