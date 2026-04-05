import { List, ActionPanel, Action } from "@raycast/api";
import { useState } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { WorkspaceNotesEmptyView } from "./components/empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "./components/empty-views/workspace";
import { type WorkspaceSection, usePinnedNotes } from "./hooks/usePinnedNotes";
import { searchPinnedNotesPreferences } from "./lib/preferences";
import { IndexedNote } from "./lib/notes";
import { openPinnedNote } from "./lib/octarine";
import { match } from "./utils/match";

export default function SearchPinnedNotesCommand() {
  const preferences = searchPinnedNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceSections, filteredWorkspaceSections, searchState, isLoading } = usePinnedNotes({
    searchText,
    selectedWorkspace,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search pinned notes"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceSections.map((workspaceSection) => (
            <List.Dropdown.Item
              key={workspaceSection.path}
              title={workspaceSection.name}
              value={workspaceSection.path}
            />
          ))}
        </List.Dropdown>
      }
    >
      {match(searchState, {
        loading: () => null,
        noConfiguredWorkspaces: () => <WorkspaceListEmptyView />,
        noAvailableNotes: () => <WorkspaceNotesEmptyView />,
        noMatchingNotes: () => <SearchNotesEmptyView />,
        showByWorkspace: () => (
          <WorkspaceSectionList sections={filteredWorkspaceSections} counter={preferences.showWorkspaceNoteCount} />
        ),
        showFlat: () => <NoteList sections={filteredWorkspaceSections} />,
      })}
    </List>
  );
}

function WorkspaceSectionList({ sections, counter }: { sections: WorkspaceSection[]; counter: boolean }) {
  return sections.map((workspaceSection) => (
    <List.Section
      key={workspaceSection.path}
      title={counter ? `${workspaceSection.name} (${workspaceSection.notes.length})` : workspaceSection.name}
    >
      {workspaceSection.notes.map((note) => (
        <NoteItem key={note.id} note={note} />
      ))}
    </List.Section>
  ));
}

function NoteList({ sections }: { sections: WorkspaceSection[] }) {
  return sections.flatMap((workspaceSection) =>
    workspaceSection.notes.map((note) => <NoteItem key={note.id} note={note} />),
  );
}

function NoteItem({ note }: { note: IndexedNote }) {
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
