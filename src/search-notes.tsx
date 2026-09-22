import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { NotesEmptyView, PinnedNotesEmptyView } from "@components/empty-views/notes";
import { SearchNotesEmptyView } from "@components/empty-views/search";
import { NotesList } from "@components/notes-list";
import { WorkspaceDropdown } from "@components/workspace-dropdown";
import { useContentSearch } from "@hooks/useContentSearch";
import { useNotes } from "@hooks/useNotes";
import { useWorkspaces } from "@hooks/useWorkspaces";
import { noteSearchKey, type ContentMatch } from "@lib/note-search";
import { openNote } from "@lib/octarine";
import { searchNotesPreferences } from "@lib/preferences";
import { createSearchMatcher } from "@lib/search";
import { ALL_WORKSPACES, type IndexedNote, type NoteScope } from "@type/notes";

export default function SearchNotesCommand() {
  const preferences = searchNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [searchContent, setSearchContent] = useState(preferences.searchContent);
  const [scope, setScope] = useState<NoteScope>("all");
  const [selectedWorkspace, setSelectedWorkspace] = useState(ALL_WORKSPACES);
  const [refresh, setRefresh] = useState(false);
  const disableContentSearch = useCallback(() => setSearchContent(false), []);
  const matchesMetadata = useMemo(() => createSearchMatcher(searchText), [searchText]);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
  } = useWorkspaces({ refresh });
  const {
    matches: contentMatches,
    isLoading: isContentLoading,
    revalidate: revalidateContent,
  } = useContentSearch({
    enabled: searchContent,
    searchText,
    onError: disableContentSearch,
  });
  const { dropdown, sections, isLoading, revalidate } = useNotes({
    scope,
    workspaces,
    enabled: !isWorkspacesLoading,
    searchText,
    contentMatches,
    selectedWorkspace,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
    refresh,
  });
  const onRefresh = () => {
    if (refresh) revalidate();
    else setRefresh(true);
    revalidateContent();
  };
  const hasResults = sections.some((section) => section.notes.length > 0);
  const emptyActions = (
    <DefaultActionPanel
      scope={scope}
      searchContent={searchContent}
      onScopeChange={setScope}
      onSearchContentChange={setSearchContent}
      onRefresh={onRefresh}
    />
  );

  return (
    <List
      filtering={false}
      isLoading={isLoading || isContentLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={searchContent ? "Search titles, paths, and content" : "Search notes"}
      searchBarAccessory={
        <WorkspaceDropdown sections={dropdown} value={selectedWorkspace} onChange={setSelectedWorkspace} />
      }
      throttle={searchContent}
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
          renderNote={(note) => {
            const contentMatch = matchesMetadata(note)
              ? undefined
              : contentMatches.get(noteSearchKey(note.folder.workspace.path, note.path));

            return (
              <NoteItem
                key={note.id}
                note={note}
                contentMatch={contentMatch}
                scope={scope}
                searchContent={searchContent}
                onScopeChange={setScope}
                onSearchContentChange={setSearchContent}
                onRefresh={onRefresh}
              />
            );
          }}
        />
      )}
    </List>
  );
}

function NoteItem({
  note,
  contentMatch,
  scope,
  searchContent,
  onScopeChange,
  onSearchContentChange,
  onRefresh,
}: {
  note: IndexedNote;
  contentMatch?: ContentMatch;
  scope: NoteScope;
  searchContent: boolean;
  onScopeChange: (scope: NoteScope) => void;
  onSearchContentChange: (enabled: boolean) => void;
  onRefresh: () => void;
}) {
  const accessories: List.Item.Accessory[] = [];
  if (contentMatch) accessories.push({ icon: Icon.Paragraph, tooltip: `Content match · ${note.path}` });
  if (note.pinned) accessories.push({ icon: Icon.Tack, tooltip: "Pinned" });

  return (
    <List.Item
      title={note.title}
      subtitle={contentMatch ? { value: contentMatch.excerpt, tooltip: note.path } : note.path}
      keywords={[note.path, note.folder.workspace.name]}
      accessories={accessories}
      actions={
        <DefaultActionPanel
          scope={scope}
          searchContent={searchContent}
          onScopeChange={onScopeChange}
          onSearchContentChange={onSearchContentChange}
          onRefresh={onRefresh}
        >
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.folder.workspace.name)} />
        </DefaultActionPanel>
      }
    />
  );
}

function DefaultActionPanel({
  scope,
  searchContent,
  onScopeChange,
  onSearchContentChange,
  onRefresh,
  children,
}: {
  scope: NoteScope;
  searchContent: boolean;
  onScopeChange: (scope: NoteScope) => void;
  onSearchContentChange: (enabled: boolean) => void;
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
      <Action
        title={searchContent ? "Search Titles and Paths Only" : "Search Note Contents"}
        icon={searchContent ? Icon.MagnifyingGlass : Icon.Paragraph}
        shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
        onAction={() => onSearchContentChange(!searchContent)}
      />
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}
