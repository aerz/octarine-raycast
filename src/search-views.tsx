import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { openOctarineView } from "./lib/octarine";
import { matchesSearchIndex } from "./lib/search";
import { IndexedView, scanViewsFromWorkspaces } from "./lib/views";
import { parseWorkspaceRoots } from "./lib/workspaces";

type SearchViewsPreferences = {
  workspaceRoots: string;
  showWorkspaceViewCount?: boolean;
};

function renderViewItem(view: IndexedView, onOpenView: (viewToOpen: IndexedView) => Promise<void>) {
  return (
    <List.Item
      key={view.id}
      title={view.name}
      subtitle={view.description}
      keywords={[view.workspace.name, view.description]}
      actions={
        <ActionPanel>
          <Action title="Open View in Octarine" icon={Icon.AppWindow} onAction={() => void onOpenView(view)} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchViewsCommand() {
  const preferences = getPreferenceValues<SearchViewsPreferences>();
  const showWorkspaceViewCount = preferences.showWorkspaceViewCount ?? false;
  const [workspaceNames, setWorkspaceNames] = useState<string[]>([]);
  const [views, setViews] = useState<IndexedView[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfiguredRoots, setHasConfiguredRoots] = useState(true);
  const [hasValidWorkspaces, setHasValidWorkspaces] = useState(true);
  const hasShownInvalidRootsToast = useRef(false);

  useEffect(() => {
    let canceled = false;

    const scan = async () => {
      setIsLoading(true);
      setViews([]);
      setWorkspaceNames([]);
      setHasValidWorkspaces(true);
      hasShownInvalidRootsToast.current = false;

      try {
        const roots = parseWorkspaceRoots(preferences.workspaceRoots);

        if (roots.length === 0) {
          if (!canceled) {
            setHasConfiguredRoots(false);
          }
          return;
        }

        if (!canceled) {
          setHasConfiguredRoots(true);
        }

        const result = await scanViewsFromWorkspaces();
        if (canceled) {
          return;
        }

        setHasValidWorkspaces(result.workspaceCount > 0);

        if (!result.fromCache && result.invalidRoots.length > 0 && !hasShownInvalidRootsToast.current) {
          hasShownInvalidRootsToast.current = true;
          const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
          await showToast({
            style: Toast.Style.Failure,
            title: "Some workspace roots were skipped",
            message: `${result.invalidRoots.length} ${noun} could not be read.`,
          });
        }

        setWorkspaceNames(result.workspaceViews.map((entry) => entry.workspace.name));
        setViews(result.workspaceViews.flatMap((entry) => entry.views));
      } catch (error) {
        console.error("Failed to scan Octarine views", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Views",
        });
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void scan();

    return () => {
      canceled = true;
    };
  }, []);

  const handleOpenView = async (view: IndexedView) => {
    try {
      await openOctarineView(view.workspace.name, view.name);
    } catch (error) {
      console.error("Failed to open Octarine view", { view, error });
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Open View",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

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

  const showNoWorkspacesConfigured = !isLoading && !hasConfiguredRoots;
  const showNoValidWorkspaces = !isLoading && hasConfiguredRoots && !hasValidWorkspaces;
  const showNoViewsFound = !isLoading && hasConfiguredRoots && hasValidWorkspaces && views.length === 0;
  const showNoMatchingViews =
    !isLoading &&
    !showNoWorkspacesConfigured &&
    !showNoValidWorkspaces &&
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
      {showNoWorkspacesConfigured ? (
        <List.EmptyView
          title="No Workspaces Configured"
          description="Open extension preferences and set Workspace Root Paths."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={() => void openCommandPreferences()} />
            </ActionPanel>
          }
        />
      ) : null}
      {showNoValidWorkspaces ? (
        <List.EmptyView
          title="No Valid Workspaces Discovered"
          description="A valid workspace must contain a .octarine folder."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={() => void openCommandPreferences()} />
            </ActionPanel>
          }
        />
      ) : null}
      {showNoViewsFound ? (
        <List.EmptyView
          title="No Views Found"
          description="No workspace contains a .octarine/views.json file with views."
        />
      ) : null}
      {showNoMatchingViews ? <List.EmptyView title="No Matching Views" /> : null}
      {!showNoWorkspacesConfigured && !showNoValidWorkspaces && !showNoViewsFound && !showNoMatchingViews
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
                  {viewsInWorkspace.map((view) => renderViewItem(view, handleOpenView))}
                </List.Section>
              );
            })
          : searchFilteredViews.map((view) => renderViewItem(view, handleOpenView))
        : null}
    </List>
  );
}
