import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { extensionPreferences } from "../lib/preferences";
import { getNotes } from "../lib/notes";
import { createSearchMatcher } from "../lib/search";
import type { Workspace } from "../types/octarine";
import type { IndexedNote, NoteScope, WorkspaceSection } from "../types/notes";
import { useNoteSections } from "./useNoteSections";

type Options = {
  scope?: NoteScope;
  workspaces: Workspace[];
  enabled?: boolean;
  searchText: string;
  selectedWorkspace: string;
  showPinnedNotesFirst?: boolean;
  refresh?: boolean;
};

type Result = {
  dropdown: string[];
  sections: WorkspaceSection[];
  isLoading: boolean;
  revalidate: () => void;
};

export function useNotes({
  scope = "all",
  workspaces,
  enabled = true,
  searchText,
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

  const matches = useMemo(() => createSearchMatcher(searchText), [searchText]);
  const { dropdown, sections } = useNoteSections(notes, {
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
  };
}
