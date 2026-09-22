import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { extensionPreferences } from "@lib/preferences";
import { getNotes } from "@lib/notes";
import { noteMatch, type ContentMatch, type NoteMatch } from "@lib/note-search";
import { createSearchMatcher } from "@lib/search";
import type { Workspace } from "@type/octarine";
import type { IndexedNote, NoteScope, WorkspaceSection } from "@type/notes";
import { useNoteSections } from "@hooks/useNoteSections";

const EMPTY_CONTENT_MATCHES = new Map<string, ContentMatch>();

type Options = {
  scope?: NoteScope;
  workspaces: Workspace[];
  enabled?: boolean;
  searchText: string;
  contentMatches?: ReadonlyMap<string, ContentMatch>;
  selectedWorkspace: string;
  showPinnedNotesFirst?: boolean;
  refresh?: boolean;
};

type Result = {
  dropdown: string[];
  sections: WorkspaceSection[];
  isLoading: boolean;
  revalidate: () => void;
  matchOf: (note: IndexedNote) => NoteMatch | undefined;
};

export function useNotes({
  scope = "all",
  workspaces,
  enabled = true,
  searchText,
  contentMatches = EMPTY_CONTENT_MATCHES,
  selectedWorkspace,
  showPinnedNotesFirst = false,
  refresh = false,
}: Options): Result {
  const preferences = extensionPreferences();
  const excludedKey = JSON.stringify([...preferences.excludedFoldersInWorkspaces].sort());

  const {
    data: notes,
    isLoading,
    revalidate,
  } = useCachedPromise(
    async (refresh: boolean, workspaces: Workspace[], excludedKey: string): Promise<IndexedNote[]> => {
      const excludedDirectories = new Set(JSON.parse(excludedKey) as string[]);
      return getNotes(workspaces, excludedDirectories, { refresh });
    },
    [refresh, workspaces, excludedKey],
    {
      execute: enabled,
      initialData: [] satisfies IndexedNote[],
      keepPreviousData: true,
      onError: async (error) => {
        console.error(`Failed to scan Octarine notes`, error);
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to Scan Notes`,
          message: error instanceof Error ? error.message : String(error),
        });
      },
      onData: () => {
        if (refresh) {
          showToast({
            style: Toast.Style.Success,
            title: "Notes refreshed",
          });
        }
      },
    },
  );

  const matchesMetadata = useMemo(() => createSearchMatcher(searchText), [searchText]);
  const matchOf = useMemo(
    () => (note: IndexedNote) => noteMatch(note, { matchesMetadata, contentMatches }),
    [contentMatches, matchesMetadata],
  );
  const matches = useMemo(() => (note: IndexedNote) => matchOf(note) !== undefined, [matchOf]);
  const orderedNotes = useMemo(() => {
    if (contentMatches.size === 0) return notes;

    return notes.toSorted((a, b) => Number(!matchesMetadata(a)) - Number(!matchesMetadata(b)));
  }, [contentMatches, matchesMetadata, notes]);
  const { dropdown, sections } = useNoteSections(orderedNotes, {
    scope,
    selectedWorkspace,
    matches,
    showPinnedNotesFirst,
  });

  return {
    dropdown,
    sections,
    isLoading: !enabled || isLoading,
    revalidate,
    matchOf,
  };
}
