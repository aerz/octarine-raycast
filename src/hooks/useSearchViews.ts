import { startTransition, useEffect, useMemo, useState } from "react";
import { skippedRootsToast, viewsLoadToast } from "../components/Toasts";
import { matchesSearchIndex } from "../lib/search";
import {
  loadCachedViews,
  saveCachedViews,
  type IndexedView,
  type WorkspaceViews,
  scanViewsFromWorkspaces,
} from "../lib/views";

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
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [workspaceViews, setWorkspaceViews] = useState<WorkspaceViews[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    const loadViews = async () => {
      setIsLoading(true);

      try {
        if (!hasConfiguredRoots) {
          if (!canceled) {
            startTransition(() => {
              setWorkspaceCount(0);
              setWorkspaceViews([]);
            });
          }
          return;
        }

        const cached = await loadCachedViews(workspaceDiscoverySignature);

        if (cached && !canceled) {
          startTransition(() => {
            setWorkspaceCount(cached.workspaces.length);
            setWorkspaceViews(cached.workspaceViews);
          });
        } else if (!canceled) {
          startTransition(() => {
            setWorkspaceCount(0);
            setWorkspaceViews([]);
          });
        }

        const refreshed = await scanViewsFromWorkspaces({ forceRefresh: true });
        if (canceled) {
          return;
        }

        await saveCachedViews(
          refreshed.workspaceViews.map((entry) => entry.workspace),
          refreshed.workspaceViews,
          workspaceDiscoverySignature,
        );

        if (refreshed.invalidRoots.length > 0) {
          await skippedRootsToast(refreshed.invalidRoots.length);
        }

        startTransition(() => {
          setWorkspaceCount(refreshed.workspaceCount);
          setWorkspaceViews(refreshed.workspaceViews);
        });
      } catch (error) {
        console.error("Failed to scan Octarine views", error);
        await viewsLoadToast();
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void loadViews();

    return () => {
      canceled = true;
    };
  }, [hasConfiguredRoots, workspaceDiscoverySignature]);

  const workspaceNames = useMemo(() => workspaceViews.map((entry) => entry.workspace.name), [workspaceViews]);
  const hasValidWorkspaces = workspaceCount > 0;

  const { availableViewCount, matchingViews, sections } = useMemo(() => {
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
  }, [workspaceViews, searchText, selectedWorkspace]);

  const searchState = getSearchState({
    isLoading,
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
  hasConfiguredRoots,
  hasValidWorkspaces,
  availableViewCount,
  matchedViewCount,
  selectedWorkspace,
}: {
  isLoading: boolean;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  availableViewCount: number;
  matchedViewCount: number;
  selectedWorkspace: string;
}): SearchState {
  if (isLoading && availableViewCount === 0) {
    return "loading";
  }

  if (!hasConfiguredRoots || !hasValidWorkspaces) {
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
