import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { type WorkspaceSection, useNotes } from "./hooks/useNotes";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openNote } from "./lib/octarine";
import { type IndexedNote } from "./types/notes";
import { searchNotesPreferences } from "./lib/preferences";

type WorkspaceDropdownProps = {
  sections: string[];
  onWorkspaceChange: (value: string) => void;
};

type NotesListProps = {
  workspaces: WorkspaceSection[];
  grouped?: boolean;
  counter?: boolean;
};

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaces } = useWorkspaces();
  const { dropdown, sections, isLoading } = useNotes({
    workspaces,
    searchText,
    selectedWorkspace,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  });
  const hasResults = sections.some((section) => section.notes.length > 0);

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search notes"
      searchBarAccessory={<WorkspaceDropdown sections={dropdown} onWorkspaceChange={setSelectedWorkspace} />}
    >
      {dropdown.length === 0 ? (
        <NotesEmptyView />
      ) : !hasResults ? (
        <SearchNotesEmptyView />
      ) : selectedWorkspace === "all" ? (
        <NotesList workspaces={sections} grouped counter={preferences.showWorkspaceNoteCount} />
      ) : (
        <NotesList workspaces={sections} />
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

function NotesList({ workspaces, grouped = false, counter = false }: NotesListProps) {
  if (grouped) {
    return workspaces.map((workspace) => (
      <List.Section
        key={workspace.path}
        title={counter ? `${workspace.name} (${workspace.notes.length})` : workspace.name}
      >
        {workspace.notes.map((note) => (
          <NoteItem key={note.id} note={note} />
        ))}
      </List.Section>
    ));
  }

  return workspaces.flatMap((workspace) => workspace.notes.map((note) => <NoteItem key={note.id} note={note} />));
}

function NoteItem({ note }: { note: IndexedNote }) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      accessories={note.pinned ? [{ icon: Icon.Tack, tooltip: "Pinned" }] : undefined}
      actions={
        <ActionPanel>
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.workspace.name)} />
        </ActionPanel>
      }
    />
  );
}

function NotesEmptyView() {
  return (
    <List.EmptyView
      icon={Icon.Document}
      title="No notes in any workspace"
      description="Create a note in Octarine to see it here"
    />
  );
}
