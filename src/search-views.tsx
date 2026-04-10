import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { SearchViewsEmptyView } from "./components/empty-views/search-results";
import { type WorkspaceViewSection, useViews } from "./hooks/useViews";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openView } from "./lib/octarine";
import { IndexedView } from "./types/views";
import { searchViewsPreferences } from "./lib/preferences";

type WorkspaceDropdownProps = {
  workspaces: string[];
  value: string;
  onWorkspaceChange: (value: string) => void;
};

type WorkspaceViewSectionsProps = {
  sections: WorkspaceViewSection[];
  grouped?: boolean;
  showWorkspaceViewCount?: boolean;
  onRefresh: () => void;
};

export default function SearchViewsCommand() {
  const preferences = searchViewsPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [refresh, setRefresh] = useState(false);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
  } = useWorkspaces({ refresh });
  const { dropdown, sections, isLoading, revalidate } = useViews({
    workspaces,
    enabled: !isWorkspacesLoading,
    searchText,
    selectedWorkspace,
    refresh,
  });
  const onRefresh = () => (refresh ? revalidate() : setRefresh(true));
  const hasResults = sections.some((section) => section.views.length > 0);

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search views"
      searchBarAccessory={
        <WorkspaceDropdown workspaces={dropdown} value={selectedWorkspace} onWorkspaceChange={setSelectedWorkspace} />
      }
    >
      {dropdown.length === 0 ? (
        <ViewsEmptyView actions={<DefaultActionPanel onRefresh={onRefresh} />} />
      ) : !hasResults ? (
        <SearchViewsEmptyView actions={<DefaultActionPanel onRefresh={onRefresh} />} />
      ) : selectedWorkspace === "all" ? (
        <WorkspaceViewSections
          grouped
          sections={sections}
          showWorkspaceViewCount={preferences.showWorkspaceViewCount}
          onRefresh={onRefresh}
        />
      ) : (
        <WorkspaceViewSections sections={sections} onRefresh={onRefresh} />
      )}
    </List>
  );
}

function WorkspaceDropdown({ workspaces, value, onWorkspaceChange }: WorkspaceDropdownProps) {
  return (
    <List.Dropdown tooltip="Filter by workspace" value={value} onChange={onWorkspaceChange}>
      <List.Dropdown.Item title="All" value="all" />
      {workspaces.map((workspace) => (
        <List.Dropdown.Item key={workspace} title={workspace} value={workspace} />
      ))}
    </List.Dropdown>
  );
}

function WorkspaceViewSections({
  sections,
  grouped = false,
  showWorkspaceViewCount = false,
  onRefresh,
}: WorkspaceViewSectionsProps) {
  if (grouped) {
    return sections.map((section) => (
      <List.Section
        key={section.workspace}
        title={showWorkspaceViewCount ? `${section.workspace} (${section.views.length})` : section.workspace}
      >
        {section.views.map((view) => (
          <ViewItem key={view.id} view={view} onRefresh={onRefresh} />
        ))}
      </List.Section>
    ));
  }

  return sections.flatMap((section) =>
    section.views.map((view) => <ViewItem key={view.id} view={view} onRefresh={onRefresh} />),
  );
}

function ViewItem({ view, onRefresh }: { view: IndexedView; onRefresh: () => void }) {
  return (
    <List.Item
      title={view.name}
      subtitle={view.description}
      keywords={[view.workspace.name]}
      actions={
        <DefaultActionPanel onRefresh={onRefresh}>
          <Action
            title="Open View in Octarine"
            icon={Icon.AppWindow}
            onAction={() => void openView(view.workspace.name, view.name)}
          />
        </DefaultActionPanel>
      }
    />
  );
}

function DefaultActionPanel({ onRefresh, children }: { onRefresh: () => void; children?: ReactNode }) {
  return (
    <ActionPanel>
      {children}
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}

function ViewsEmptyView({ actions }: { actions?: ReactNode }) {
  return (
    <List.EmptyView
      icon={Icon.AppWindowGrid2x2}
      title="No Views Available"
      description="No workspace contains an .octarine/views.json file."
      actions={actions}
    />
  );
}
