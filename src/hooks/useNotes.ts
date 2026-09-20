import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { extensionPreferences } from "../lib/preferences";
import { getNotes } from "../lib/notes";
import { querySearchText } from "../lib/search";
import type { Workspace } from "../types/octarine";
import type { IndexedNote } from "../types/notes";

export type WorkspaceSection = {
  name: string;
  path: string;
  notes: IndexedNote[];
};

export type NoteScope = "all" | "pinned";

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

  const {
    data: notes,
    isLoading,
    revalidate,
  } = useCachedPromise(
    async (refresh: boolean, workspaces: Workspace[]): Promise<IndexedNote[]> =>
      getNotes(workspaces, preferences.excludedFoldersInWorkspaces, { refresh }),
    [refresh, workspaces],
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

  const { dropdown, sections } = useMemo(() => {
    const grouped = groupByWorkspace(notes);

    return {
      dropdown: workspaceNames(grouped),
      sections: buildWorkspaceSections(grouped, { scope, selectedWorkspace, searchText, showPinnedNotesFirst }),
    };
  }, [notes, scope, searchText, selectedWorkspace, showPinnedNotesFirst]);

  return {
    dropdown,
    sections,
    isLoading: !enabled || isLoading,
    revalidate,
  };
}

function groupByWorkspace(notes: IndexedNote[]): WorkspaceSection[] {
  const grouped = new Map<string, WorkspaceSection>();

  for (const note of notes) {
    const section = grouped.get(note.folder.workspace.path);

    if (section) {
      section.notes.push(note);
    } else {
      grouped.set(note.folder.workspace.path, {
        name: note.folder.workspace.name,
        path: note.folder.workspace.path,
        notes: [note],
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function workspaceNames(workspaces: WorkspaceSection[]): string[] {
  return Array.from(new Set(workspaces.map((workspace) => workspace.name)));
}

function buildWorkspaceSections(
  workspaces: WorkspaceSection[],
  {
    scope,
    selectedWorkspace,
    searchText,
    showPinnedNotesFirst,
  }: {
    scope: NoteScope;
    selectedWorkspace: string;
    searchText: string;
    showPinnedNotesFirst: boolean;
  },
): WorkspaceSection[] {
  return workspaces
    .filter((workspace) => selectedWorkspace === "all" || workspace.name === selectedWorkspace)
    .map((workspace) => {
      const notes = workspace.notes.filter((note) => {
        if (scope === "pinned" && !note.pinned) return false;
        return !searchText || querySearchText(note, searchText);
      });

      return {
        name: workspace.name,
        path: workspace.path,
        notes: sortPinnedNotesFirst(notes, showPinnedNotesFirst),
      };
    })
    .filter((workspace) => workspace.notes.length > 0);
}

function sortPinnedNotesFirst(notes: IndexedNote[], showPinnedNotesFirst: boolean): IndexedNote[] {
  if (!showPinnedNotesFirst || notes.length < 2) {
    return notes;
  }

  const pinned: IndexedNote[] = [];
  const unpinned: IndexedNote[] = [];

  for (const note of notes) {
    if (note.pinned) {
      pinned.push(note);
    } else {
      unpinned.push(note);
    }
  }

  if (pinned.length === 0 || unpinned.length === 0) {
    return notes;
  }

  return [...pinned, ...unpinned];
}
