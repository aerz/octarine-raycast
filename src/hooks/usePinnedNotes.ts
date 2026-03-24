import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import type { SearchPinnedNotesPreferences } from "../lib/preferences";
import { IndexedNote, refreshPinnedNotesCache } from "../lib/notes";
import { loadWorkspaces } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

export type PinnedNoteWorkspaceSection = {
  workspacePath: string;
  workspaceName: string;
  notes: IndexedNote[];
};

type Result = {
  workspaces: Workspace[];
  notes: IndexedNote[];
  workspaceSections: PinnedNoteWorkspaceSection[];
  isLoading: boolean;
  error: Error | undefined;
};

type PinnedNotesScanResult = {
  workspaces: Workspace[];
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

function buildWorkspaceSections(notes: IndexedNote[]): PinnedNoteWorkspaceSection[] {
  const grouped = new Map<string, PinnedNoteWorkspaceSection>();

  for (const note of notes) {
    const existing = grouped.get(note.workspace.path);
    if (existing) {
      existing.notes.push(note);
    } else {
      grouped.set(note.workspace.path, {
        workspacePath: note.workspace.path,
        workspaceName: note.workspace.name,
        notes: [note],
      });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
}

export function usePinnedNotes(preferences: SearchPinnedNotesPreferences): Result {
  const hasConfiguredRoots = preferences.extension.hasConfiguredRoots;
  const { data, error, isLoading } = useCachedPromise(
    async (workspaceSearchSignature: string): Promise<PinnedNotesScanResult> => {
      void workspaceSearchSignature;
      const showScanFailureToast = createScanFailureToast();

      const workspaceResult = await loadWorkspaces({ forceRefresh: true });
      const notes = await refreshPinnedNotesCache(
        workspaceResult.workspaces,
        preferences.extension.excludedFoldersInWorkspaces,
        preferences.extension.workspaceSearchSignature,
        showScanFailureToast,
      );

      return {
        workspaces: workspaceResult.workspaces,
        notes,
      };
    },
    [preferences.extension.workspaceSearchSignature],
    {
      execute: hasConfiguredRoots,
      initialData: {
        workspaces: [],
        notes: [],
      } satisfies PinnedNotesScanResult,
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

  return {
    workspaces: data.workspaces,
    notes: data.notes,
    workspaceSections,
    isLoading,
    error,
  };
}
