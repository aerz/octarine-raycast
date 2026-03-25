import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { useViews } from "./hooks/useViews";
import { openOctarineView } from "./lib/octarine";
import { getSearchViewsPreferences } from "./lib/preferences";
import { IndexedView } from "./lib/views";

type ViewState = "loading" | "workspace-not-found" | "no-views" | "no-matching-views" | "show-sections" | "show-flat";

export default function SearchViewsCommand() {
  const preferences = getSearchViewsPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const {
    workspaceNames,
    visibleViews,
    sections,
    isLoading,
    error,
    hasConfiguredRoots,
    hasValidWorkspaces,
    totalViewCount,
  } = useViews({
    searchText,
    selectedWorkspace,
    workspaceDiscoverySignature: preferences.extension.workspaceDiscoverySignature,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
  });
  const viewState = getViewState({
    isLoading,
    error,
    hasConfiguredRoots,
    hasValidWorkspaces,
    totalViewCount,
    visibleViewCount: visibleViews.length,
    selectedWorkspace,
  });

  function renderContent() {
    switch (viewState) {
      case "loading":
        return null;
      case "workspace-not-found":
        return <WorkspaceNotFound />;
      case "no-views":
        return <WorkspaceContentEmptyView resource="views" />;
      case "no-matching-views":
        return <SearchResultsEmptyView resource="views" />;
      case "show-sections":
        return sections.map((section) => (
          <List.Section
            key={section.workspaceName}
            title={
              preferences.showWorkspaceViewCount
                ? `${section.workspaceName} (${section.views.length})`
                : section.workspaceName
            }
          >
            {section.views.map((view) => (
              <ViewItem key={view.id} view={view} />
            ))}
          </List.Section>
        ));
      case "show-flat":
        return visibleViews.map((view) => <ViewItem key={view.id} view={view} />);
      default:
        return assertNever(viewState);
    }
  }

  return (
    <List
      filtering={false}
      isLoading={viewState === "loading"}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search views..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {renderContent()}
    </List>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled view state: ${String(value)}`);
}

function getViewState({
  isLoading,
  error,
  hasConfiguredRoots,
  hasValidWorkspaces,
  totalViewCount,
  visibleViewCount,
  selectedWorkspace,
}: {
  isLoading: boolean;
  error: Error | undefined;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  totalViewCount: number;
  visibleViewCount: number;
  selectedWorkspace: string;
}): ViewState {
  if (isLoading && totalViewCount === 0) {
    return "loading";
  }

  if (error || !hasConfiguredRoots || !hasValidWorkspaces) {
    return "workspace-not-found";
  }

  if (totalViewCount === 0) {
    return "no-views";
  }

  if (visibleViewCount === 0) {
    return "no-matching-views";
  }

  if (selectedWorkspace === "all") {
    return "show-sections";
  }

  return "show-flat";
}

function ViewItem({ view }: { view: IndexedView }) {
  return (
    <List.Item
      title={view.name}
      subtitle={view.description}
      keywords={[view.workspace.name]}
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
