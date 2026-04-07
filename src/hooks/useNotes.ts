import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { extensionPreferences } from "../lib/preferences";
import { loadNotes } from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import type { Workspace } from "../types/octarine";
import type { IndexedNote } from "../types/notes";

export type WorkspaceSection = {
  name: string;
  path: string;
  notes: IndexedNote[];
};

type Options = {
  workspaces: Workspace[];
  searchText: string;
  selectedWorkspace: string;
  showPinnedNotesFirst: boolean;
  refresh?: boolean;
};

type Result = {
  dropdown: string[];
  sections: WorkspaceSection[];
  isLoading: boolean;
  revalidate: () => void;
};

export function useNotes({
  workspaces,
  searchText,
  selectedWorkspace,
  showPinnedNotesFirst,
  refresh = false,
}: Options): Result {
  const preferences = extensionPreferences();

  const { data, isLoading, revalidate } = useCachedPromise(
    async (refresh: boolean, workspaces: Workspace[]): Promise<IndexedNote[]> => {
      return loadNotes(workspaces, preferences.excludedFoldersInWorkspaces, { refresh });
    },
    [refresh, workspaces],
    {
      initialData: [] satisfies IndexedNote[],
      keepPreviousData: true,
      onError: async (error) => {
        console.error("Failed to scan Octarine notes", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Notes",
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

  const grouped = useMemo(() => groupByWorkspace(data), [data]);
  const dropdown = useMemo(() => dropdownNames(grouped), [grouped]);
  const sections = useMemo(
    () => filterWorkspaces(grouped, selectedWorkspace, searchText, showPinnedNotesFirst),
    [grouped, searchText, selectedWorkspace, showPinnedNotesFirst],
  );

  return {
    dropdown,
    sections,
    isLoading,
    revalidate,
  };
}

function groupByWorkspace(notes: IndexedNote[]): WorkspaceSection[] {
  const grouped = new Map<string, WorkspaceSection>();

  for (const note of notes) {
    const section = grouped.get(note.workspace.path);

    if (section) {
      section.notes.push(note);
    } else {
      grouped.set(note.workspace.path, {
        name: note.workspace.name,
        path: note.workspace.path,
        notes: [note],
      });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function dropdownNames(workspaces: WorkspaceSection[]): string[] {
  return Array.from(new Set(workspaces.map((workspace) => workspace.name)));
}

function filterWorkspaces(
  workspaces: WorkspaceSection[],
  selectedWorkspace: string,
  searchText: string,
  showPinnedNotesFirst: boolean,
): WorkspaceSection[] {
  return workspaces
    .filter((workspace) => selectedWorkspace === "all" || workspace.name === selectedWorkspace)
    .map((workspace) => {
      const notes = searchText
        ? workspace.notes.filter((note) => matchesPathSearch(note, searchText))
        : workspace.notes;

      return {
        name: workspace.name,
        path: workspace.path,
        notes: orderPinnedNotesFirst(notes, showPinnedNotesFirst),
      };
    })
    .filter((workspace) => workspace.notes.length > 0);
}

function orderPinnedNotesFirst(notes: IndexedNote[], showPinnedNotesFirst: boolean): IndexedNote[] {
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
