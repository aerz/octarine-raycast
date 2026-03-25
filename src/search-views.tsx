import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { type WorkspaceViewSection, useSearchViews } from "./hooks/useSearchViews";
import { openOctarineView } from "./lib/octarine";
import { getSearchViewsPreferences } from "./lib/preferences";
import { IndexedView } from "./lib/views";
import { match } from "./utils/match";

export default function SearchViewsCommand() {
  const preferences = getSearchViewsPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceNames, matchingViews, sections, searchState } = useSearchViews({
    searchText,
    selectedWorkspace,
    workspaceDiscoverySignature: preferences.extension.workspaceDiscoverySignature,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
  });

  return (
    <List
      filtering={false}
      isLoading={searchState === "loading"}
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
      {match(searchState, {
        loading: () => null,
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noAvailableViews: () => <WorkspaceContentEmptyView resource="views" />,
        noMatchingViews: () => <SearchResultsEmptyView resource="views" />,
        showByWorkspace: () => (
          <WorkspaceSectionList sections={sections} showWorkspaceViewCount={preferences.showWorkspaceViewCount} />
        ),
        showFlat: () => matchingViews.map((view) => <ViewItem key={view.id} view={view} />),
      })}
    </List>
  );
}

function WorkspaceSectionList({
  sections,
  showWorkspaceViewCount,
}: {
  sections: WorkspaceViewSection[];
  showWorkspaceViewCount: boolean;
}) {
  return sections.map((section) => (
    <List.Section
      key={section.workspaceName}
      title={showWorkspaceViewCount ? `${section.workspaceName} (${section.views.length})` : section.workspaceName}
    >
      {section.views.map((view) => (
        <ViewItem key={view.id} view={view} />
      ))}
    </List.Section>
  ));
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
