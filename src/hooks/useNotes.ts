import { Toast, showToast } from "@raycast/api";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  type IndexedNote,
  loadCachedNotes,
  loadCachedPinnedNotes,
  refreshPinnedNotesCache,
  saveCachedNotes,
  scanNotesFromWorkspaces,
  toPinnedNoteIds,
} from "../lib/notes";
import { matchesPathSearch } from "../lib/search";
import { loadWorkspaces } from "../lib/workspaces";
import { extensionPreferences } from "../lib/preferences";
import type { Workspace } from "../types/octarine";

export type NoteWorkspaceSection = {
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
  showPinnedNotesFirst: boolean;
};

type Result = {
  workspaceNames: string[];
  matchingNotes: IndexedNote[];
  sections: NoteWorkspaceSection[];
  searchState: SearchState;
  isLoading: boolean;
  pinnedNoteIds: Set<string>;
};

type NotesSourceState = {
  workspaces: Workspace[];
  notes: IndexedNote[];
  pinnedNoteIds: Set<string>;
  isLoading: boolean;
};

type NotesSourceOptions = {
  excludedDirectoryNames: Set<string>;
  workspaceSearchSignature: string;
  hasConfiguredRoots: boolean;
};

export function useNotes({ searchText, selectedWorkspace, showPinnedNotesFirst }: Options): Result {
  const preferences = extensionPreferences();

  const source = useNotesSource({
    excludedDirectoryNames: preferences.excludedFoldersInWorkspaces,
    workspaceSearchSignature: preferences.workspaceSearchSignature,
    hasConfiguredRoots: preferences.hasConfiguredRoots,
  });

  const workspaceNames = useMemo(() => buildWorkspaceNames(source.workspaces), [source.workspaces]);
  const matchingNotes = useMemo(
    () =>
      buildMatchingNotes({
        notes: source.notes,
        searchText,
        selectedWorkspace,
        pinnedNoteIds: source.pinnedNoteIds,
        showPinnedNotesFirst,
      }),
    [source.notes, searchText, selectedWorkspace, source.pinnedNoteIds, showPinnedNotesFirst],
  );
  const sections = useMemo(() => buildWorkspaceSections(matchingNotes), [matchingNotes]);
  const searchState = getSearchState({
    isLoading: source.isLoading,
    hasConfiguredRoots: preferences.hasConfiguredRoots,
    workspaceCount: source.workspaces.length,
    noteCount: source.notes.length,
    visibleNoteCount: matchingNotes.length,
    selectedWorkspace,
  });

  return {
    workspaceNames,
    matchingNotes,
    sections,
    searchState,
    isLoading: source.isLoading,
    pinnedNoteIds: source.pinnedNoteIds,
  };
}

function useNotesSource({
  excludedDirectoryNames,
  workspaceSearchSignature,
  hasConfiguredRoots,
}: NotesSourceOptions): NotesSourceState {
  const excludedDirectoryNamesRef = useRef(excludedDirectoryNames);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<IndexedNote[]>([]);
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Keep the latest excluded directories available to the scan effect
  // without depending on the unstable Set identity.
  excludedDirectoryNamesRef.current = excludedDirectoryNames;

  useEffect(() => {
    let canceled = false;

    const setSourceData = ({
      nextWorkspaces,
      nextNotes,
      nextPinnedNoteIds,
    }: {
      nextWorkspaces: Workspace[];
      nextNotes: IndexedNote[];
      nextPinnedNoteIds: Set<string>;
    }) => {
      if (canceled) {
        return;
      }

      startTransition(() => {
        setWorkspaces(nextWorkspaces);
        setNotes(nextNotes);
        setPinnedNoteIds(nextPinnedNoteIds);
      });
    };

    const clearSourceData = () => {
      setSourceData({
        nextWorkspaces: [],
        nextNotes: [],
        nextPinnedNoteIds: new Set(),
      });
    };

    const setCachedSourceData = (
      cachedWorkspaces: Workspace[],
      cachedNotes: IndexedNote[],
      cachedPinnedNoteIds: Set<string>,
    ) => {
      setSourceData({
        nextWorkspaces: cachedWorkspaces,
        nextNotes: cachedNotes,
        nextPinnedNoteIds: cachedPinnedNoteIds,
      });
    };

    const setLoadedSourceData = (
      loadedWorkspaces: Workspace[],
      loadedNotes: IndexedNote[],
      loadedPinnedNoteIds: Set<string>,
    ) => {
      setSourceData({
        nextWorkspaces: loadedWorkspaces,
        nextNotes: loadedNotes,
        nextPinnedNoteIds: loadedPinnedNoteIds,
      });
    };

    const scan = async () => {
      let hasReportedPartialScanFailure = false;

      setIsLoading(true);

      const reportPartialScanFailure = async () => {
        if (canceled || hasReportedPartialScanFailure) {
          return;
        }

        hasReportedPartialScanFailure = true;
        await showPartialScanFailureToast();
      };

      try {
        if (!hasConfiguredRoots) {
          clearSourceData();
          return;
        }

        const workspaceResultPromise = loadWorkspaces({ refresh: true });
        const [cachedResult, cachedPinnedResult] = await Promise.all([
          loadCachedNotes(workspaceSearchSignature),
          loadCachedPinnedNotes(workspaceSearchSignature),
        ]);
        const hasCachedResult = Boolean(cachedResult);

        if (cachedResult || cachedPinnedResult) {
          setCachedSourceData(
            cachedResult?.workspaces ?? cachedPinnedResult?.workspaces ?? [],
            cachedResult?.notes ?? [],
            toPinnedNoteIds(cachedPinnedResult?.notes ?? []),
          );
        } else {
          clearSourceData();
        }

        const workspaceResult = await workspaceResultPromise;
        if (canceled) {
          return;
        }

        if (!hasCachedResult) {
          startTransition(() => {
            setWorkspaces(workspaceResult.workspaces);
          });
        }

        const [discoveredNotes, pinnedNotes] = await Promise.all([
          scanNotesFromWorkspaces(
            workspaceResult.workspaces,
            excludedDirectoryNamesRef.current,
            reportPartialScanFailure,
          ),
          refreshPinnedNotesCache(
            workspaceResult.workspaces,
            excludedDirectoryNamesRef.current,
            workspaceSearchSignature,
            reportPartialScanFailure,
          ),
        ]);
        if (canceled) {
          return;
        }

        await saveCachedNotes(workspaceResult.workspaces, discoveredNotes, workspaceSearchSignature);

        setLoadedSourceData(workspaceResult.workspaces, discoveredNotes, toPinnedNoteIds(pinnedNotes));
      } catch (error) {
        if (!canceled) {
          await handleFatalScanFailure(error);
        }
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void scan();

    return () => {
      canceled = true;
    };
  }, [hasConfiguredRoots, workspaceSearchSignature]);

  return {
    workspaces,
    notes,
    pinnedNoteIds,
    isLoading,
  };
}

async function showPartialScanFailureToast(): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: "Failed to Scan Some Notes",
  });
}

async function handleFatalScanFailure(error: unknown): Promise<void> {
  console.error("Failed to scan Octarine notes", error);
  await showToast({
    style: Toast.Style.Failure,
    title: "Failed to Scan Notes",
  });
}

function buildWorkspaceNames(workspaces: Workspace[]): string[] {
  return Array.from(new Set(workspaces.map((workspace) => workspace.name))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function buildMatchingNotes({
  notes,
  searchText,
  selectedWorkspace,
  pinnedNoteIds,
  showPinnedNotesFirst,
}: {
  notes: IndexedNote[];
  searchText: string;
  selectedWorkspace: string;
  pinnedNoteIds: Set<string>;
  showPinnedNotesFirst: boolean;
}): IndexedNote[] {
  return orderNotesByPinnedState(
    notes
      .filter((note) => selectedWorkspace === "all" || note.workspace.name === selectedWorkspace)
      .filter((note) => matchesPathSearch(note, searchText)),
    pinnedNoteIds,
    showPinnedNotesFirst,
  );
}

function buildWorkspaceSections(notes: IndexedNote[]): NoteWorkspaceSection[] {
  const grouped = new Map<string, NoteWorkspaceSection>();

  for (const note of notes) {
    const existing = grouped.get(note.workspace.name);
    if (existing) {
      existing.notes.push(note);
    } else {
      grouped.set(note.workspace.name, {
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

function orderNotesByPinnedState(
  notes: IndexedNote[],
  pinnedNoteIds: Set<string>,
  showPinnedNotesFirst: boolean,
): IndexedNote[] {
  if (!showPinnedNotesFirst || notes.length < 2) {
    return notes;
  }

  const pinnedNotes: IndexedNote[] = [];
  const unpinnedNotes: IndexedNote[] = [];

  for (const note of notes) {
    if (pinnedNoteIds.has(note.id)) {
      pinnedNotes.push(note);
    } else {
      unpinnedNotes.push(note);
    }
  }

  if (pinnedNotes.length === 0 || unpinnedNotes.length === 0) {
    return notes;
  }

  return [...pinnedNotes, ...unpinnedNotes];
}
