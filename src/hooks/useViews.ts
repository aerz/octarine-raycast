import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { skippedRootsToast, viewsLoadToast } from "../components/toasts";
import { extensionPreferences } from "../lib/preferences";
import { matchesSearchIndex } from "../lib/search";
import {
  loadCachedViews,
  saveCachedViews,
  type IndexedView,
  type WorkspaceViews,
  scanViewsFromWorkspaces,
} from "../lib/views";

export type WorkspaceViewSection = {
  workspace: string;
  views: IndexedView[];
};

type RenderState =
  | "loading"
  | "noConfiguredWorkspaces"
  | "noAvailableViews"
  | "noMatchingViews"
  | "showByWorkspace"
  | "showFlat";

type Options = {
  searchText: string;
  selectedWorkspace: string;
};

type Result = {
  workspaceNames: string[];
  matchingViews: IndexedView[];
  sections: WorkspaceViewSection[];
  renderState: RenderState;
};

type SearchResultsInput = {
  views: WorkspaceViews[];
  search: string;
  workspace: string;
};

type RenderStateInput = {
  loading: boolean;
  hasConfiguredRoots: boolean;
  hasWorkspaces: boolean;
  availableCount: number;
  matchedCount: number;
  workspace: string;
};

export function useViews({ searchText, selectedWorkspace }: Options): Result {
  const prefs = extensionPreferences();

  const { workspaceViews, isLoading, loadError, skippedRootsCount } = useViewsSource({
    hasConfiguredRoots: prefs.hasConfiguredRoots,
    workspaceDiscoverySignature: prefs.workspaceDiscoverySignature,
  });
  useViewsToasts({ loadError, skippedRootsCount });

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
  const renderStateInput: RenderStateInput = {
    loading: isLoading,
    hasConfiguredRoots: prefs.hasConfiguredRoots,
    hasWorkspaces,
    availableCount,
    matchedCount: matchingViews.length,
    workspace: selectedWorkspace,
  };

  return {
    workspaceNames,
    matchingViews,
    sections,
    renderState: getRenderState(renderStateInput),
  };
}

function useViewsSource({
  hasConfiguredRoots,
  workspaceDiscoverySignature,
}: {
  hasConfiguredRoots: boolean;
  workspaceDiscoverySignature: string;
}): {
  workspaceViews: WorkspaceViews[];
  isLoading: boolean;
  loadError: Error | undefined;
  skippedRootsCount: number;
} {
  const [workspaceViews, setWorkspaceViews] = useState<WorkspaceViews[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);
  const [skippedRootsCount, setSkippedRootsCount] = useState(0);

  useEffect(() => {
    let canceled = false;

    const applyViews = (views: WorkspaceViews[]) => {
      if (canceled) {
        return;
      }

      startTransition(() => {
        setWorkspaceViews(views);
      });
    };

    const loadViews = async () => {
      setIsLoading(true);
      setLoadError(undefined);
      setSkippedRootsCount(0);

      try {
        if (!hasConfiguredRoots) {
          applyViews([]);
          return;
        }

        const cached = await loadCachedViews(workspaceDiscoverySignature);
        applyViews(cached?.workspaceViews ?? []);

        const refreshed = await scanViewsFromWorkspaces({ forceRefresh: true });
        if (canceled) {
          return;
        }

        await saveCachedViews(
          refreshed.workspaceViews.map((entry) => entry.workspace),
          refreshed.workspaceViews,
          workspaceDiscoverySignature,
        );
        if (canceled) {
          return;
        }

        setSkippedRootsCount(refreshed.invalidRoots.length);
        applyViews(refreshed.workspaceViews);
      } catch (error) {
        if (!canceled) {
          setLoadError(toError(error));
        }
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

  return {
    workspaceViews,
    isLoading,
    loadError,
    skippedRootsCount,
  };
}

function useViewsToasts({
  loadError,
  skippedRootsCount,
}: {
  loadError: Error | undefined;
  skippedRootsCount: number;
}): void {
  const previousSkippedRootsCount = useRef(0);

  useEffect(() => {
    if (!loadError) {
      return;
    }

    console.error("Failed to scan Octarine views", loadError);
    void viewsLoadToast();
  }, [loadError]);

  useEffect(() => {
    if (skippedRootsCount > 0 && skippedRootsCount !== previousSkippedRootsCount.current) {
      void skippedRootsToast(skippedRootsCount);
    }

    previousSkippedRootsCount.current = skippedRootsCount;
  }, [skippedRootsCount]);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
      workspace: entry.workspace.name,
      views: workspaceMatchingViews,
    });
  }

  return { availableCount, matchingViews, sections };
}

function getRenderState({
  loading,
  hasConfiguredRoots,
  hasWorkspaces,
  availableCount,
  matchedCount,
  workspace,
}: RenderStateInput): RenderState {
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
