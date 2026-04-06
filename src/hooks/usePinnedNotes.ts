import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { loadPinnedNotes } from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import { extensionPreferences } from "../lib/preferences";
import { loadWorkspaces } from "../lib/workspaces";
import type { IndexedNote } from "../types/notes";

export type WorkspaceSection = {
  name: string;
  path: string;
  notes: IndexedNote[];
};

type Options = {
  searchText: string;
  selectedWorkspace: string;
  refresh?: boolean;
};

type Result = {
  sections: string[];
  workspaces: WorkspaceSection[];
  isLoading: boolean;
  revalidate: () => void;
};

function groupSections(notes: IndexedNote[]): WorkspaceSection[] {
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

export function usePinnedNotes({ searchText, selectedWorkspace, refresh = false }: Options): Result {
  const preferences = extensionPreferences();

  const { data, isLoading, revalidate } = useCachedPromise(
    async (refresh: boolean): Promise<IndexedNote[]> => {
      const { workspaces } = await loadWorkspaces({ refresh });

      if (workspaces.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No valid workspaces found. Check your paths in preferences.",
        });
        return [];
      }

      return loadPinnedNotes(workspaces, preferences.excludedFoldersInWorkspaces, { refresh });
    },
    [refresh],
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

  const groupedSections = useMemo(() => groupSections(data), [data]);

  const sections = useMemo(() => Array.from(new Set(groupedSections.map((ws) => ws.name))), [groupedSections]);

  const workspaces = useMemo(
    () =>
      groupedSections
        .filter((workspace) => selectedWorkspace === "all" || workspace.name === selectedWorkspace)
        .map((workspace) => ({
          path: workspace.path,
          name: workspace.name,
          notes: searchText ? workspace.notes.filter((note) => matchesPathSearch(note, searchText)) : workspace.notes,
        }))
        .filter((workspace) => workspace.notes.length > 0),
    [groupedSections, searchText, selectedWorkspace],
  );

  return {
    sections,
    workspaces,
    isLoading,
    revalidate,
  };
}
