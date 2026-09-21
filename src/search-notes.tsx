import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { NotesEmptyView, PinnedNotesEmptyView } from "./components/empty-views/notes";
import { SearchNotesEmptyView } from "./components/empty-views/search";
import { NotesList } from "./components/notes-list";
import { WorkspaceDropdown } from "./components/workspace-dropdown";
import { useNotes } from "./hooks/useNotes";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openNote } from "./lib/octarine";
import { searchNotesPreferences } from "./lib/preferences";
import { ALL_WORKSPACES, type IndexedNote, type NoteScope } from "./types/notes";

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [scope, setScope] = useState<NoteScope>("all");
  const [selectedWorkspace, setSelectedWorkspace] = useState(ALL_WORKSPACES);
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
      ) : (
        <NotesList
          sections={sections}
          grouped={selectedWorkspace === ALL_WORKSPACES}
          counter={preferences.showWorkspaceNoteCount}
          renderNote={(note) => (
            <NoteItem key={note.id} note={note} scope={scope} onScopeChange={setScope} onRefresh={onRefresh} />
          )}
        />
      )}
    </List>
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
