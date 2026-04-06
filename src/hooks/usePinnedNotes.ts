import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { loadPinnedNotes } from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import { extensionPreferences } from "../lib/preferences";
import type { IndexedNote } from "../types/notes";
import type { Workspace } from "../types/octarine";

export type WorkspaceSection = {
  name: string;
  path: string;
  notes: IndexedNote[];
};

type Options = {
  workspaces: Workspace[];
  searchText: string;
  selectedWorkspace: string;
  refresh?: boolean;
};

type Result = {
  dropdown: string[];
  sections: WorkspaceSection[];
  isLoading: boolean;
  revalidate: () => void;
};

export function usePinnedNotes({ workspaces, searchText, selectedWorkspace, refresh = false }: Options): Result {
  const preferences = extensionPreferences();

  const { data, isLoading, revalidate } = useCachedPromise(
    async (refresh: boolean, workspaces: Workspace[]): Promise<IndexedNote[]> => {
      return loadPinnedNotes(workspaces, preferences.excludedFoldersInWorkspaces, { refresh });
    },
    [refresh, workspaces],
    {
      initialData: [] satisfies IndexedNote[],
      keepPreviousData: true,
      onError: async (error) => {
        console.error("Failed to scan pinned Octarine notes", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Pinned Notes",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    },
  );

  const grouped = useMemo(() => groupByWorkspace(data), [data]);
  const dropdown = useMemo(() => dropdownNames(grouped), [grouped]);
  const sections = useMemo(
    () => filterWorkspaces(grouped, selectedWorkspace, searchText),
    [grouped, searchText, selectedWorkspace],
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
): WorkspaceSection[] {
  return workspaces
    .filter((workspace) => selectedWorkspace === "all" || workspace.name === selectedWorkspace)
    .map((workspace) => ({
      path: workspace.path,
      name: workspace.name,
      notes: searchText ? workspace.notes.filter((note) => matchesPathSearch(note, searchText)) : workspace.notes,
    }))
    .filter((workspace) => workspace.notes.length > 0);
}
