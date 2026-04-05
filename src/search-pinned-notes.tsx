import { List, ActionPanel, Action } from "@raycast/api";
import { useState } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { WorkspaceNotesEmptyView } from "./components/empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "./components/empty-views/workspace";
import { type WorkspaceSection, usePinnedNotes } from "./hooks/usePinnedNotes";
import { searchPinnedNotesPreferences } from "./lib/preferences";
import { IndexedNote } from "./lib/notes";
import { openPinnedNote } from "./lib/octarine";

type WorkspaceDropdownProps = {
  workspaces: WorkspaceSection[];
  onWorkspaceChange: (value: string) => void;
};

type NotesListProps = {
  workspaces: WorkspaceSection[];
  grouped?: boolean;
  counter?: boolean;
};

type NoteItemProps = {
  note: IndexedNote;
};

export default function SearchPinnedNotesCommand() {
  const preferences = searchPinnedNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceCount, workspaceSections, filteredWorkspaceSections, isLoading } = usePinnedNotes({
    searchText,
    selectedWorkspace,
  });
  const [totalNotes, filteredNotes] = [workspaceSections, filteredWorkspaceSections].map((sections) =>
    sections.reduce((count, ws) => count + ws.notes.length, 0),
  );

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search pinned notes"
      searchBarAccessory={<WorkspaceDropdown workspaces={workspaceSections} onWorkspaceChange={setSelectedWorkspace} />}
    >
      {workspaceCount === 0 ? (
        <WorkspaceListEmptyView />
      ) : totalNotes === 0 ? (
        <WorkspaceNotesEmptyView />
      ) : filteredNotes === 0 ? (
        <SearchNotesEmptyView />
      ) : selectedWorkspace === "all" ? (
        <NotesList workspaces={filteredWorkspaceSections} grouped counter={preferences.showWorkspaceNoteCount} />
      ) : (
        <NotesList workspaces={filteredWorkspaceSections} />
      )}
    </List>
  );
}

function WorkspaceDropdown({ workspaces, onWorkspaceChange }: WorkspaceDropdownProps) {
  return (
    <List.Dropdown tooltip="Filter by workspace" onChange={onWorkspaceChange}>
      <List.Dropdown.Item title="All" value="all" />
      {workspaces.map((workspace) => (
        <List.Dropdown.Item title={workspace.name} key={workspace.path} value={workspace.path} />
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

function NoteItem({ note }: NoteItemProps) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <ActionPanel>
          <Action title="Open Pinned Note" onAction={() => void openPinnedNote(note.path, note.workspace.name)} />
        </ActionPanel>
      }
    />
  );
}
