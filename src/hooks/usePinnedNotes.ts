import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { IndexedNote, refreshPinnedNotesCache } from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import { extensionPreferences } from "../lib/preferences";
import { loadWorkspaces } from "../lib/workspaces";

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
  workspaceCount: number;
  workspaceSections: WorkspaceSection[];
  filteredWorkspaceSections: WorkspaceSection[];
  isLoading: boolean;
};

type ScanPinnedNotesResult = {
  workspaceCount: number;
  notes: IndexedNote[];
};

function createScanFailureToast(): () => Promise<void> {
  let shown = false;

  return async () => {
    if (shown) {
      return;
    }

    shown = true;
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to Scan Some Pinned Notes",
    });
  };
}

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

export function usePinnedNotes({ searchText, selectedWorkspace }: Options): Result {
  const preferences = extensionPreferences();

  const { data, isLoading } = useCachedPromise(
    async (workspaceSearchSignature: string): Promise<ScanPinnedNotesResult> => {
      void workspaceSearchSignature;
      const showScanFailureToast = createScanFailureToast();
      const { workspaces } = await loadWorkspaces({ refresh: true });

      if (workspaces.length === 0) {
        return {
          workspaceCount: 0,
          notes: [],
        };
      }

      const notes = await refreshPinnedNotesCache(
        workspaces,
        preferences.excludedFoldersInWorkspaces,
        workspaceSearchSignature,
        showScanFailureToast,
      );

      return {
        workspaceCount: workspaces.length,
        notes,
      };
    },
    [preferences.workspaceSearchSignature],
    {
      execute: preferences.hasConfiguredRoots,
      initialData: {
        workspaceCount: 0,
        notes: [],
      } satisfies ScanPinnedNotesResult,
      keepPreviousData: true,
      onError: async (error) => {
        console.error("Failed to scan pinned Octarine notes", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Pinned Notes",
        });
      },
    },
  );

  const workspaceSections = useMemo(() => buildWorkspaceSections(data.notes), [data.notes]);
  const filteredWorkspaceSections = useMemo(
    () =>
      workspaceSections
        .filter(
          (workspaceSection) => selectedWorkspace === "all" || workspaceSection.path === selectedWorkspace,
        )
        .map((workspaceSection) => ({
          path: workspaceSection.path,
          name: workspaceSection.name,
          notes: workspaceSection.notes.filter((note) => matchesPathSearch(note, searchText)),
        }))
        .filter((workspaceSection) => workspaceSection.notes.length > 0),
    [searchText, selectedWorkspace, workspaceSections],
  );

  return {
    workspaceCount: data.workspaceCount,
    workspaceSections,
    filteredWorkspaceSections,
    isLoading,
  };
}
