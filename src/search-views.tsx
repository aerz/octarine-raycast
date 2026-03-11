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
import { OctarineView, scanViewsFromWorkspaces } from "./lib/views";
import { parseWorkspaceRoots } from "./lib/workspaces";

type SearchViewsPreferences = {
  workspaceRoots: string;
};

function matchesSearchQuery(view: OctarineView, searchText: string): boolean {
  const normalizedQuery = searchText.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  const haystack = `${view.name} ${view.description ?? ""} ${view.workspaceName}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function renderViewItem(view: OctarineView, onOpenView: (viewToOpen: OctarineView) => Promise<void>) {
  return (
    <List.Item
      key={view.id}
      title={view.name}
      subtitle={view.description}
      keywords={[view.workspaceName, view.description ?? ""]}
      actions={
        <ActionPanel>
          <Action title="Open View in Octarine" icon={Icon.AppWindow} onAction={() => void onOpenView(view)} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchViewsCommand() {
  const [workspaceNames, setWorkspaceNames] = useState<string[]>([]);
  const [views, setViews] = useState<OctarineView[]>([]);
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
        const preferences = getPreferenceValues<SearchViewsPreferences>();
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

  const handleOpenView = async (view: OctarineView) => {
    try {
      await openOctarineView(view.workspaceName, view.name);
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
    () => views.filter((view) => selectedWorkspace === "all" || view.workspaceName === selectedWorkspace),
    [views, selectedWorkspace],
  );

  const searchFilteredViews = useMemo(
    () => filteredViews.filter((view) => matchesSearchQuery(view, searchText)),
    [filteredViews, searchText],
  );

  const viewsByWorkspace = useMemo(() => {
    const groupedViews = new Map<string, OctarineView[]>();

    for (const view of searchFilteredViews) {
      const viewsInWorkspace = groupedViews.get(view.workspaceName);
      if (viewsInWorkspace) {
        viewsInWorkspace.push(view);
      } else {
        groupedViews.set(view.workspaceName, [view]);
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
                <List.Section key={workspaceName} title={workspaceName}>
                  {viewsInWorkspace.map((view) => renderViewItem(view, handleOpenView))}
                </List.Section>
              );
            })
          : searchFilteredViews.map((view) => renderViewItem(view, handleOpenView))
        : null}
    </List>
  );
}
