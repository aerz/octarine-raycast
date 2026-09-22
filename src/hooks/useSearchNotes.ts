import { useCallback, useState } from "react";
import { useContentSearch } from "@hooks/useContentSearch";
import { useNotes } from "@hooks/useNotes";
import { useWorkspaces } from "@hooks/useWorkspaces";
import type { NoteMatch } from "@lib/note-search";
import { ALL_WORKSPACES, type IndexedNote, type NoteScope, type WorkspaceSection } from "@type/notes";

export type SearchNotesMode = {
  scope: NoteScope;
  contentEnabled: boolean;
};

export type SearchNotesActions = {
  onSearchTextChange: (text: string) => void;
  onWorkspaceChange: (workspace: string) => void;
  toggleScope: () => void;
  toggleContent: () => void;
  refresh: () => void;
};

type Options = {
  searchContent: boolean;
  showPinnedNotesFirst: boolean;
};

type Result = {
  isLoading: boolean;
  search: { text: string };
  mode: SearchNotesMode;
  workspace: { dropdown: string[]; selected: string; grouped: boolean };
  results: { sections: WorkspaceSection[]; matchOf: (note: IndexedNote) => NoteMatch | undefined };
  actions: SearchNotesActions;
};

/** When content search fails or lacks permission, `mode.contentEnabled` turns off so results fall back to titles and paths. */
export function useSearchNotes({ searchContent, showPinnedNotesFirst }: Options): Result {
  const [searchText, setSearchText] = useState("");
  const [contentEnabled, setContentEnabled] = useState(searchContent);
  const [scope, setScope] = useState<NoteScope>("all");
  const [selectedWorkspace, setSelectedWorkspace] = useState(ALL_WORKSPACES);
  const [refresh, setRefresh] = useState(false);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
  } = useWorkspaces({ refresh });
  const disableContentSearch = useCallback(() => setContentEnabled(false), []);
  const {
    matches: contentMatches,
    isLoading: isContentLoading,
    revalidate: revalidateNotesContent,
  } = useContentSearch({
    enabled: contentEnabled,
    searchText,
    onError: disableContentSearch,
  });
  const {
    dropdown,
    sections,
    isLoading,
    revalidate: revalidateNotes,
    matchOf,
  } = useNotes({
    scope,
    workspaces,
    enabled: !isWorkspacesLoading,
    searchText,
    contentMatches,
    selectedWorkspace,
    showPinnedNotesFirst,
    refresh,
  });

  return {
    isLoading: isLoading || isContentLoading,
    search: { text: searchText },
    mode: { scope, contentEnabled },
    workspace: {
      dropdown,
      selected: selectedWorkspace,
      grouped: selectedWorkspace === ALL_WORKSPACES,
    },
    results: { sections, matchOf },
    actions: {
      onSearchTextChange: setSearchText,
      onWorkspaceChange: setSelectedWorkspace,
      toggleScope: () => setScope((current) => (current === "pinned" ? "all" : "pinned")),
      toggleContent: () => setContentEnabled((current) => !current),
      refresh: () => {
        if (refresh) {
          revalidateNotes();
        } else {
          setRefresh(true);
        }

        revalidateNotesContent();
      },
    },
  };
}
