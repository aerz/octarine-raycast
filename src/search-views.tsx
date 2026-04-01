import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchViewsEmptyView } from "./components/empty-views/search-results";
import { WorkspaceViewsEmptyView } from "./components/empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "./components/empty-views/workspace";
import { type WorkspaceViewSection, useViews } from "./hooks/useViews";
import { openView } from "./lib/octarine";
import { IndexedView } from "./lib/views";
import { searchViewsPreferences } from "./lib/preferences";
import { match } from "./utils/match";

export default function SearchViewsCommand() {
  const preferences = searchViewsPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceNames, matchingViews, sections, renderState } = useViews({
    searchText,
    selectedWorkspace,
  });

  return (
    <List
      filtering={false}
      isLoading={renderState === "loading"}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search views"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {match(renderState, {
        loading: () => null,
        noConfiguredWorkspaces: () => <WorkspaceListEmptyView />,
        noAvailableViews: () => <WorkspaceViewsEmptyView />,
        noMatchingViews: () => <SearchViewsEmptyView />,
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
      key={section.workspace}
      title={showWorkspaceViewCount ? `${section.workspace} (${section.views.length})` : section.workspace}
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
            onAction={() => void openView(view.workspace.name, view.name)}
          />
        </ActionPanel>
      }
    />
  );
}
