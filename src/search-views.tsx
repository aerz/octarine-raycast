import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  showToast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { SearchResultsEmptyView } from "./components/empty-views/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/empty-views/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/empty-views/WorkspaceNotFound";
import { openOctarineView } from "./lib/octarine";
import { matchesSearchIndex } from "./lib/search";
import { IndexedView, scanViewsFromWorkspaces } from "./lib/views";
import { parseWorkspaceRoots } from "./lib/workspaces";

type SearchViewsPreferences = {
  workspaceRoots: string;
  excludedFolders?: string;
  showWorkspaceViewCount?: boolean;
};

function renderViewItem(view: IndexedView) {
  return (
    <List.Item
      key={view.id}
      title={view.name}
      subtitle={view.description}
      keywords={[view.workspace.name, view.description]}
      actions={
        <ActionPanel>
          <Action
            title="Open View in Octarine"
            icon={Icon.AppWindow}
            onAction={() => void openOctarineView(view.workspace.name, view.name)}
          />
        </ActionPanel>
      }
    />
  );
}

export default function SearchViewsCommand() {
  const preferences = getPreferenceValues<SearchViewsPreferences>();
  const showWorkspaceViewCount = preferences.showWorkspaceViewCount ?? false;
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const cacheKey = [preferences.workspaceRoots, preferences.excludedFolders ?? ""].filter(Boolean).join("::");
  const hasConfiguredRoots = parseWorkspaceRoots(preferences.workspaceRoots).length > 0;
  const {
    data: scanResult,
    error: scanError,
    isLoading,
  } = useCachedPromise(
    async (preferenceCacheKey: string) => {
      if (!preferenceCacheKey) {
        return {
          workspaceCount: 0,
          workspaceViews: [],
          invalidRoots: [],
          fromCache: true,
        };
      }

      return scanViewsFromWorkspaces();
    },
    [cacheKey],
    {
      execute: hasConfiguredRoots,
      onData: async (result) => {
        if (!result.fromCache && result.invalidRoots.length > 0) {
          const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
          await showToast({
            style: Toast.Style.Failure,
            title: "Some workspace roots were skipped",
            message: `${result.invalidRoots.length} ${noun} could not be read.`,
          });
        }
      },
      onError: async (error) => {
        console.error("Failed to scan Octarine views", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Views",
        });
      },
    },
  );

  const workspaceNames = useMemo(
    () => scanResult?.workspaceViews.map((entry) => entry.workspace.name) ?? [],
    [scanResult],
  );
  const views = useMemo(() => scanResult?.workspaceViews.flatMap((entry) => entry.views) ?? [], [scanResult]);
  const hasValidWorkspaces = (scanResult?.workspaceCount ?? 0) > 0;

  const filteredViews = useMemo(
    () => views.filter((view) => selectedWorkspace === "all" || view.workspace.name === selectedWorkspace),
    [views, selectedWorkspace],
  );

  const searchFilteredViews = useMemo(
    () => filteredViews.filter((view) => matchesSearchIndex(view.searchText, searchText)),
    [filteredViews, searchText],
  );

  const viewsByWorkspace = useMemo(() => {
    const groupedViews = new Map<string, IndexedView[]>();

    for (const view of searchFilteredViews) {
      const workspaceName = view.workspace.name;
      const viewsInWorkspace = groupedViews.get(workspaceName);
      if (viewsInWorkspace) {
        viewsInWorkspace.push(view);
      } else {
        groupedViews.set(workspaceName, [view]);
      }
    }

    return groupedViews;
  }, [searchFilteredViews]);

  const showWorkspaceNotFound = !isLoading && !scanError && (!hasConfiguredRoots || !hasValidWorkspaces);
  const showNoViewsFound = !isLoading && !scanError && !showWorkspaceNotFound && views.length === 0;
  const showNoMatchingViews =
    !isLoading &&
    !scanError &&
    !showWorkspaceNotFound &&
    views.length > 0 &&
    searchFilteredViews.length === 0;

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Octarine views..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {showWorkspaceNotFound ? <WorkspaceNotFound /> : null}
      {showNoViewsFound ? <WorkspaceContentEmptyView resource="views" /> : null}
      {showNoMatchingViews ? <SearchResultsEmptyView resource="views" /> : null}
      {!showWorkspaceNotFound && !showNoViewsFound && !showNoMatchingViews
        ? selectedWorkspace === "all"
          ? workspaceNames.map((workspaceName) => {
              const viewsInWorkspace = viewsByWorkspace.get(workspaceName) ?? [];
              if (viewsInWorkspace.length === 0) {
                return null;
              }

              return (
                <List.Section
                  key={workspaceName}
                  title={showWorkspaceViewCount ? `${workspaceName} (${viewsInWorkspace.length})` : workspaceName}
                >
                  {viewsInWorkspace.map((view) => renderViewItem(view))}
                </List.Section>
              );
            })
          : searchFilteredViews.map((view) => renderViewItem(view))
        : null}
    </List>
  );
}
