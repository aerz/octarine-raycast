import { List } from "@raycast/api";
import { NotesEmptyView, PinnedNotesEmptyView } from "@components/empty-views/notes";
import { SearchNotesEmptyView } from "@components/empty-views/search";
import { NotesList } from "@components/notes-list";
import { NoteItem, SearchNotesActionPanel } from "@components/search-notes/notes";
import { WorkspaceDropdown } from "@components/workspace-dropdown";
import { useSearchNotes } from "@hooks/useSearchNotes";
import { searchNotesPreferences } from "@lib/preferences";

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const { isLoading, search, mode, workspace, results, actions } = useSearchNotes({
    searchContent: preferences.searchContent,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  });
  const hasResults = results.sections.some((section) => section.notes.length > 0);
  const panel = <SearchNotesActionPanel mode={mode} actions={actions} />;

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      throttle={mode.contentEnabled}
      onSearchTextChange={actions.onSearchTextChange}
      searchBarPlaceholder={searchPlaceholder(mode.contentEnabled)}
      searchBarAccessory={
        <WorkspaceDropdown
          sections={workspace.dropdown}
          value={workspace.selected}
          onChange={actions.onWorkspaceChange}
        />
      }
    >
      {workspace.dropdown.length === 0 ? (
        <NotesEmptyView actions={panel} />
      ) : mode.pinnedOnly && !search.text && !hasResults ? (
        <PinnedNotesEmptyView actions={panel} />
      ) : !hasResults ? (
        <SearchNotesEmptyView actions={panel} />
      ) : (
        <NotesList
          sections={results.sections}
          grouped={workspace.grouped}
          counter={preferences.showWorkspaceNoteCount}
          renderNote={(note) => (
            <NoteItem key={note.id} result={{ note, match: results.matchOf(note) }} mode={mode} actions={actions} />
          )}
        />
      )}
    </List>
  );
}

function searchPlaceholder(contentEnabled: boolean): string {
  return contentEnabled ? "Search titles, paths, and content" : "Search notes";
}
