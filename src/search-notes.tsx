import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { type NoteScope, type WorkspaceSection, useNotes } from "./hooks/useNotes";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openNote } from "./lib/octarine";
import { searchNotesPreferences } from "./lib/preferences";
import { type IndexedNote } from "./types/notes";

type WorkspaceDropdownProps = {
  sections: string[];
  value: string;
  onChange: (value: string) => void;
};

type NotesListProps = {
  workspaces: WorkspaceSection[];
  grouped?: boolean;
  counter?: boolean;
  scope: NoteScope;
  onScopeChange: (scope: NoteScope) => void;
  onRefresh: () => void;
};

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [scope, setScope] = useState<NoteScope>("all");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [refresh, setRefresh] = useState(false);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
  } = useWorkspaces({ refresh });
  const { dropdown, sections, isLoading, revalidate } = useNotes({
    scope,
    workspaces,
    enabled: !isWorkspacesLoading,
    searchText,
    selectedWorkspace,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
    refresh,
  });
  const onRefresh = () => (refresh ? revalidate() : setRefresh(true));
  const hasResults = sections.some((section) => section.notes.length > 0);
  const emptyActions = <DefaultActionPanel scope={scope} onScopeChange={setScope} onRefresh={onRefresh} />;

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search notes"
      searchBarAccessory={
        <WorkspaceDropdown sections={dropdown} value={selectedWorkspace} onChange={setSelectedWorkspace} />
      }
    >
      {dropdown.length === 0 ? (
        <NotesEmptyView actions={emptyActions} />
      ) : !hasResults ? (
        scope === "pinned" && !searchText ? (
          <PinnedNotesEmptyView actions={emptyActions} />
        ) : (
          <SearchNotesEmptyView actions={emptyActions} />
        )
      ) : selectedWorkspace === "all" ? (
        <NotesList
          workspaces={sections}
          grouped
          counter={preferences.showWorkspaceNoteCount}
          scope={scope}
          onScopeChange={setScope}
          onRefresh={onRefresh}
        />
      ) : (
        <NotesList workspaces={sections} scope={scope} onScopeChange={setScope} onRefresh={onRefresh} />
      )}
    </List>
  );
}

function WorkspaceDropdown({ sections, value, onChange }: WorkspaceDropdownProps) {
  return (
    <List.Dropdown tooltip="Filter by workspace" value={value} onChange={onChange}>
      <List.Dropdown.Item title="All Workspaces" value="all" />
      {sections.map((section) => (
        <List.Dropdown.Item title={section} key={section} value={section} />
      ))}
    </List.Dropdown>
  );
}

function NotesList({ workspaces, grouped = false, counter = false, scope, onScopeChange, onRefresh }: NotesListProps) {
  if (grouped) {
    return workspaces.map((workspace) => (
      <List.Section
        key={workspace.path}
        title={counter ? `${workspace.name} (${workspace.notes.length})` : workspace.name}
      >
        {workspace.notes.map((note) => (
          <NoteItem key={note.id} note={note} scope={scope} onScopeChange={onScopeChange} onRefresh={onRefresh} />
        ))}
      </List.Section>
    ));
  }

  return workspaces.flatMap((workspace) =>
    workspace.notes.map((note) => (
      <NoteItem key={note.id} note={note} scope={scope} onScopeChange={onScopeChange} onRefresh={onRefresh} />
    )),
  );
}

function NoteItem({
  note,
  scope,
  onScopeChange,
  onRefresh,
}: {
  note: IndexedNote;
  scope: NoteScope;
  onScopeChange: (scope: NoteScope) => void;
  onRefresh: () => void;
}) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.folder.workspace.name]}
      accessories={note.pinned ? [{ icon: Icon.Tack, tooltip: "Pinned" }] : undefined}
      actions={
        <DefaultActionPanel scope={scope} onScopeChange={onScopeChange} onRefresh={onRefresh}>
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.folder.workspace.name)} />
        </DefaultActionPanel>
      }
    />
  );
}

function DefaultActionPanel({
  scope,
  onScopeChange,
  onRefresh,
  children,
}: {
  scope: NoteScope;
  onScopeChange: (scope: NoteScope) => void;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const isPinnedOnly = scope === "pinned";

  return (
    <ActionPanel>
      {children}
      <Action
        title={isPinnedOnly ? "Show All Notes" : "Show Pinned Notes Only"}
        icon={isPinnedOnly ? Icon.Document : Icon.Tack}
        onAction={() => onScopeChange(isPinnedOnly ? "all" : "pinned")}
      />
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}

function NotesEmptyView({ actions }: { actions?: ReactNode }) {
  return (
    <List.EmptyView
      icon={Icon.Document}
      title="No notes in any workspace"
      description="Create a note in Octarine to see it here"
      actions={actions}
    />
  );
}

function PinnedNotesEmptyView({ actions }: { actions?: ReactNode }) {
  return (
    <List.EmptyView
      icon={Icon.Tack}
      title="No pinned notes"
      description="Pin a note in Octarine to see it here"
      actions={actions}
    />
  );
}
