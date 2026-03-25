import { List } from "@raycast/api";
import { useState } from "react";
import { PinnedNoteActions } from "./components/PinnedNoteActions";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { type PinnedNoteWorkspaceSection, usePinnedNotes } from "./hooks/usePinnedNotes";
import { getSearchPinnedNotesPreferences } from "./lib/preferences";
import { IndexedNote } from "./lib/notes";
import { match } from "./utils/match";

export default function SearchPinnedNotesCommand() {
  const preferences = getSearchPinnedNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceSections, filteredWorkspaceSections, searchState, isLoading } = usePinnedNotes({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames: preferences.extension.excludedFoldersInWorkspaces,
    workspaceSearchSignature: preferences.extension.workspaceSearchSignature,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search pinned notes..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceSections.map((workspaceSection) => (
            <List.Dropdown.Item
              key={workspaceSection.workspacePath}
              title={workspaceSection.workspaceName}
              value={workspaceSection.workspacePath}
            />
          ))}
        </List.Dropdown>
      }
    >
      {match(searchState, {
        loading: () => null,
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noAvailableNotes: () => <WorkspaceContentEmptyView resource="notes" />,
        noMatchingNotes: () => <SearchResultsEmptyView resource="notes" />,
        showByWorkspace: () => (
          <WorkspaceSectionList
            sections={filteredWorkspaceSections}
            showWorkspaceNoteCount={preferences.showWorkspaceNoteCount}
          />
        ),
        showFlat: () => <NoteList sections={filteredWorkspaceSections} />,
      })}
    </List>
  );
}

function WorkspaceSectionList({
  sections,
  showWorkspaceNoteCount,
}: {
  sections: PinnedNoteWorkspaceSection[];
  showWorkspaceNoteCount: boolean;
}) {
  return sections.map((workspaceSection) => (
    <List.Section
      key={workspaceSection.workspacePath}
      title={
        showWorkspaceNoteCount
          ? `${workspaceSection.workspaceName} (${workspaceSection.notes.length})`
          : workspaceSection.workspaceName
      }
    >
      {workspaceSection.notes.map((note) => (
        <NoteItem key={note.id} note={note} />
      ))}
    </List.Section>
  ));
}

function NoteList({ sections }: { sections: PinnedNoteWorkspaceSection[] }) {
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
      actions={<PinnedNoteActions note={note} />}
    />
  );
}
