import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { type WorkspaceSection, useNotes } from "./hooks/useNotes";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { searchPinnedNotesPreferences } from "./lib/preferences";
import { openPinnedNote } from "./lib/octarine";
import type { IndexedNote } from "./types/notes";

type WorkspaceDropdownProps = {
  sections: string[];
  onWorkspaceChange: (value: string) => void;
};

type NotesListProps = {
  workspaces: WorkspaceSection[];
  grouped?: boolean;
  counter?: boolean;
  onRefresh: () => void;
};

type NoteItemProps = {
  note: IndexedNote;
  onRefresh: () => void;
};

export default function SearchPinnedNotesCommand() {
  const preferences = searchPinnedNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [refresh, setRefresh] = useState(false);
  const { workspaces } = useWorkspaces({ refresh });
  const { dropdown, sections, isLoading, revalidate } = useNotes({
    scope: "pinned",
    workspaces,
    searchText,
    selectedWorkspace,
    refresh,
  });
  const onRefresh = () => (refresh ? revalidate() : setRefresh(true));
  const hasResults = sections.some((section) => section.notes.length > 0);

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search pinned notes"
      searchBarAccessory={<WorkspaceDropdown sections={dropdown} onWorkspaceChange={setSelectedWorkspace} />}
    >
      {dropdown.length === 0 ? (
        <NotesEmptyView actions={<DefaultActionPanel onRefresh={onRefresh} />} />
      ) : !hasResults ? (
        <SearchNotesEmptyView actions={<DefaultActionPanel onRefresh={onRefresh} />} />
      ) : selectedWorkspace === "all" ? (
        <NotesList workspaces={sections} grouped counter={preferences.showWorkspaceNoteCount} onRefresh={onRefresh} />
      ) : (
        <NotesList workspaces={sections} onRefresh={onRefresh} />
      )}
    </List>
  );
}

function WorkspaceDropdown({ sections, onWorkspaceChange }: WorkspaceDropdownProps) {
  return (
    <List.Dropdown tooltip="Filter by workspace" onChange={onWorkspaceChange}>
      <List.Dropdown.Item title="All" value="all" />
      {sections.map((section) => (
        <List.Dropdown.Item title={section} key={section} value={section} />
      ))}
    </List.Dropdown>
  );
}

function NotesList({ workspaces, grouped = false, counter = false, onRefresh }: NotesListProps) {
  if (grouped) {
    return workspaces.map((workspace) => (
      <List.Section
        key={workspace.path}
        title={counter ? `${workspace.name} (${workspace.notes.length})` : workspace.name}
      >
        {workspace.notes.map((note) => (
          <NoteItem key={note.id} note={note} onRefresh={onRefresh} />
        ))}
      </List.Section>
    ));
  }

  return workspaces.flatMap((workspace) =>
    workspace.notes.map((note) => <NoteItem key={note.id} note={note} onRefresh={onRefresh} />),
  );
}

function NoteItem({ note, onRefresh }: NoteItemProps) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <DefaultActionPanel onRefresh={onRefresh}>
          <Action title="Open Pinned Note" onAction={() => void openPinnedNote(note.path, note.workspace.name)} />
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

function NotesEmptyView({ actions }: { actions?: ReactNode }) {
  return (
    <List.EmptyView
      icon={Icon.Tack}
      title="Nothing Pinned Yet"
      description="Pin a note in Octarine to see it here."
      actions={actions}
    />
  );
}
