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

type LoadViewsInput = {
  hasConfiguredRoots: boolean;
  signature: string;
  applyViews: (views: WorkspaceViews[]) => void;
  onSkippedRoots: (count: number) => Promise<void>;
};

type SearchResultsInput = {
  views: WorkspaceViews[];
  search: string;
  workspace: string;
};

type SearchStateInput = {
  loading: boolean;
  hasConfiguredRoots: boolean;
  hasWorkspaces: boolean;
  availableCount: number;
  matchedCount: number;
  workspace: string;
};

export function useSearchViews({
  searchText,
  selectedWorkspace,
  workspaceDiscoverySignature,
  hasConfiguredRoots,
}: Options): Result {
  const [workspaceViews, setWorkspaceViews] = useState<WorkspaceViews[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    const applyViews = (views: WorkspaceViews[]) => {
      if (canceled) return;

      startTransition(() => {
        setWorkspaceViews(views);
      });
    };

    const loadViewsInput: LoadViewsInput = {
      hasConfiguredRoots,
      signature: workspaceDiscoverySignature,
      applyViews,
      onSkippedRoots: skippedRootsToast,
    };

    setIsLoading(true);

    void loadViewsData(loadViewsInput)
      .catch((error) => {
        console.error("Failed to scan Octarine views", error);
        return viewsLoadToast();
      })
      .finally(() => {
        if (!canceled) {
          setIsLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [hasConfiguredRoots, workspaceDiscoverySignature]);

  const workspaceNames = useMemo(() => workspaceViews.map((entry) => entry.workspace.name), [workspaceViews]);

  const hasWorkspaces = workspaceViews.length > 0;

  const searchResultsInput: SearchResultsInput = {
    views: workspaceViews,
    search: searchText,
    workspace: selectedWorkspace,
  };

  const { availableCount, matchingViews, sections } = useMemo(
    () => buildSearchResults(searchResultsInput),
    [workspaceViews, searchText, selectedWorkspace],
  );

  const searchStateInput: SearchStateInput = {
    loading: isLoading,
    hasConfiguredRoots,
    hasWorkspaces,
    availableCount,
    matchedCount: matchingViews.length,
    workspace: selectedWorkspace,
  };

  const searchState = getSearchState(searchStateInput);

  return {
    workspaceNames,
    matchingViews,
    sections,
    searchState,
  };
}

async function loadViewsData({ hasConfiguredRoots, signature, applyViews, onSkippedRoots }: LoadViewsInput) {
  if (!hasConfiguredRoots) {
    applyViews([]);
    return;
  }

  const cached = await loadCachedViews(signature);
  applyViews(cached?.workspaceViews ?? []);

  const refreshed = await scanViewsFromWorkspaces({ forceRefresh: true });

  await saveCachedViews(
    refreshed.workspaceViews.map((entry) => entry.workspace),
    refreshed.workspaceViews,
    signature,
  );

  if (refreshed.invalidRoots.length > 0) {
    await onSkippedRoots(refreshed.invalidRoots.length);
  }

  applyViews(refreshed.workspaceViews);
}

function buildSearchResults({ views, search, workspace }: SearchResultsInput) {
  const matchingViews: IndexedView[] = [];
  const sections: WorkspaceViewSection[] = [];
  let availableCount = 0;

  for (const entry of views) {
    const matchesWorkspace = workspace === "all" || entry.workspace.name === workspace;

    if (!matchesWorkspace) {
      continue;
    }

    availableCount += entry.views.length;

    const workspaceMatchingViews = entry.views.filter((view) => matchesSearchIndex(view.searchText, search));

    if (workspaceMatchingViews.length === 0) {
      continue;
    }

    matchingViews.push(...workspaceMatchingViews);
    sections.push({
      workspaceName: entry.workspace.name,
      views: workspaceMatchingViews,
    });
  }

  return { availableCount, matchingViews, sections };
}

function getSearchState({
  loading,
  hasConfiguredRoots,
  hasWorkspaces,
  availableCount,
  matchedCount,
  workspace,
}: SearchStateInput): SearchState {
  if (loading && availableCount === 0) {
    return "loading";
  }

  if (!hasConfiguredRoots || !hasWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (availableCount === 0) {
    return "noAvailableViews";
  }

  if (matchedCount === 0) {
    return "noMatchingViews";
  }

  if (workspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}
