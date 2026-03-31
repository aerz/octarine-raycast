import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { WorkspaceNotesEmptyView } from "./components/empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "./components/empty-views/workspace";
import { type NoteWorkspaceSection, useNotes } from "./hooks/useNotes";
import { openNote } from "./lib/octarine";
import { type IndexedNote } from "./lib/notes";
import { searchNotesPreferences } from "./lib/preferences";
import { match } from "./utils/match";

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceNames, matchingNotes, sections, searchState, isLoading, pinnedNoteIds } = useNotes({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames: preferences.extension.excludedFoldersInWorkspaces,
    workspaceSearchSignature: preferences.extension.workspaceSearchSignature,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search notes"
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
        noConfiguredWorkspaces: () => <WorkspaceListEmptyView />,
        noAvailableNotes: () => <WorkspaceNotesEmptyView />,
        noMatchingNotes: () => <SearchNotesEmptyView />,
        showByWorkspace: () => (
          <WorkspaceSectionList
            sections={sections}
            pinnedNoteIds={pinnedNoteIds}
            showWorkspaceNoteCount={preferences.showWorkspaceNoteCount}
          />
        ),
        showFlat: () =>
          matchingNotes.map((note) => <NoteItem key={note.id} note={note} pinnedNoteIds={pinnedNoteIds} />),
      })}
    </List>
  );
}

function WorkspaceSectionList({
  sections,
  pinnedNoteIds,
  showWorkspaceNoteCount,
}: {
  sections: NoteWorkspaceSection[];
  pinnedNoteIds: Set<string>;
  showWorkspaceNoteCount: boolean;
}) {
  return sections.map((section) => (
    <List.Section
      key={section.workspaceName}
      title={showWorkspaceNoteCount ? `${section.workspaceName} (${section.notes.length})` : section.workspaceName}
    >
      {section.notes.map((note) => (
        <NoteItem key={note.id} note={note} pinnedNoteIds={pinnedNoteIds} />
      ))}
    </List.Section>
  ));
}

function NoteItem({ note, pinnedNoteIds }: { note: IndexedNote; pinnedNoteIds: Set<string> }) {
  const isPinned = pinnedNoteIds.has(note.id);

  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      accessories={isPinned ? [{ icon: Icon.Geopin, tooltip: "Pinned" }] : undefined}
      actions={
        <ActionPanel>
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.workspace.name)} />
        </ActionPanel>
      }
    />
  );
}
