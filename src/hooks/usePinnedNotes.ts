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
};

type Result = {
  sections: string[];
  workspaces: WorkspaceSection[];
  isLoading: boolean;
};

function buildWorkspaceSections(notes: IndexedNote[]): WorkspaceSection[] {
  const grouped = new Map<string, WorkspaceSection>();

  for (const note of notes) {
    const existing = grouped.get(note.workspace.path);
    if (existing) {
      existing.notes.push(note);
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

function buildSectionNames(notes: IndexedNote[]): string[] {
  return Array.from(new Set(notes.map((note) => note.workspace.name))).sort((left, right) => left.localeCompare(right));
}

export function usePinnedNotes({ searchText, selectedWorkspace }: Options): Result {
  const preferences = extensionPreferences();

  const { data, isLoading } = useCachedPromise(
    async (): Promise<IndexedNote[]> => {
      const { workspaces } = await loadWorkspaces({ refresh: true });

      if (workspaces.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No valid workspaces found. Check your paths in preferences.",
        });
        return [];
      }

      return loadPinnedNotes(workspaces, preferences.excludedFoldersInWorkspaces);
    },
    [],
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

  const sections = useMemo(() => buildSectionNames(data), [data]);
  const workspaces = useMemo(
    () =>
      buildWorkspaceSections(data)
        .filter((workspace) => selectedWorkspace === "all" || workspace.name === selectedWorkspace)
        .map((workspace) => ({
          path: workspace.path,
          name: workspace.name,
          notes: workspace.notes.filter((note) => matchesPathSearch(note, searchText)),
        }))
        .filter((workspaceSection) => workspaceSection.notes.length > 0),
    [data, searchText, selectedWorkspace],
  );

  return {
    sections,
    workspaces,
    isLoading,
  };
}
