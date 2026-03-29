import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { IndexedNote, refreshPinnedNotesCache } from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import { loadWorkspaces } from "../lib/workspaces";

export type PinnedNoteWorkspaceSection = {
  workspacePath: string;
  workspaceName: string;
  notes: IndexedNote[];
};

type SearchState =
  | "loading"
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat";

type Options = {
  searchText: string;
  selectedWorkspace: string;
  excludedDirectoryNames: Set<string>;
  workspaceSearchSignature: string;
  hasConfiguredRoots: boolean;
};

type Result = {
  workspaceSections: PinnedNoteWorkspaceSection[];
  filteredWorkspaceSections: PinnedNoteWorkspaceSection[];
  searchState: SearchState;
  isLoading: boolean;
};

type PinnedNotesScanResult = {
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

function getSearchState({
  isLoading,
  hasConfiguredRoots,
  workspaceCount,
  noteCount,
  visibleNoteCount,
  selectedWorkspace,
}: {
  isLoading: boolean;
  hasConfiguredRoots: boolean;
  workspaceCount: number;
  noteCount: number;
  visibleNoteCount: number;
  selectedWorkspace: string;
}): SearchState {
  if (isLoading && noteCount === 0) {
    return "loading";
  }

  if (!hasConfiguredRoots || workspaceCount === 0) {
    return "noConfiguredWorkspaces";
  }

  if (noteCount === 0) {
    return "noAvailableNotes";
  }

  if (visibleNoteCount === 0) {
    return "noMatchingNotes";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

export function usePinnedNotes({
  searchText,
  selectedWorkspace,
  excludedDirectoryNames,
  workspaceSearchSignature,
  hasConfiguredRoots,
}: Options): Result {
  const { data, isLoading } = useCachedPromise(
    async (workspaceSearchSignature: string): Promise<PinnedNotesScanResult> => {
      void workspaceSearchSignature;
      const showScanFailureToast = createScanFailureToast();

      const workspaceResult = await loadWorkspaces({ refresh: true });
      const notes = await refreshPinnedNotesCache(
        workspaceResult.workspaces,
        excludedDirectoryNames,
        workspaceSearchSignature,
        showScanFailureToast,
      );

      return {
        workspaceCount: workspaceResult.workspaces.length,
        notes,
      };
    },
    [workspaceSearchSignature],
    {
      execute: hasConfiguredRoots,
      initialData: {
        workspaceCount: 0,
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
  const filteredWorkspaceSections = useMemo(
    () =>
      workspaceSections
        .filter(
          (workspaceSection) => selectedWorkspace === "all" || workspaceSection.workspacePath === selectedWorkspace,
        )
        .map((workspaceSection) => ({
          workspacePath: workspaceSection.workspacePath,
          workspaceName: workspaceSection.workspaceName,
          notes: workspaceSection.notes.filter((note) => matchesPathSearch(note, searchText)),
        }))
        .filter((workspaceSection) => workspaceSection.notes.length > 0),
    [searchText, selectedWorkspace, workspaceSections],
  );
  const visibleNoteCount = filteredWorkspaceSections.reduce(
    (count, workspaceSection) => count + workspaceSection.notes.length,
    0,
  );
  const searchState = getSearchState({
    isLoading,
    hasConfiguredRoots,
    workspaceCount: data.workspaceCount,
    noteCount: data.notes.length,
    visibleNoteCount,
    selectedWorkspace,
  });

  return {
    workspaceSections,
    filteredWorkspaceSections,
    searchState,
    isLoading,
  };
}
