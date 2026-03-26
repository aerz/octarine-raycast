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
  excludedDirectoryNames: Set<string>;
  workspaceSearchSignature: string;
  hasConfiguredRoots: boolean;
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

export function useNotes({
  searchText,
  selectedWorkspace,
  excludedDirectoryNames,
  workspaceSearchSignature,
  hasConfiguredRoots,
  showPinnedNotesFirst,
}: Options): Result {
  const excludedDirectoryNamesRef = useRef(excludedDirectoryNames);
  const hasShownScanErrorToast = useRef(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<IndexedNote[]>([]);
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Keep the latest excluded directories available to the scan effect
  // without depending on the unstable Set identity.
  excludedDirectoryNamesRef.current = excludedDirectoryNames;

  useEffect(() => {
    let canceled = false;

    const showScanFailureToast = async () => {
      if (hasShownScanErrorToast.current) {
        return;
      }

      hasShownScanErrorToast.current = true;
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Scan Some Notes",
      });
    };

    const scan = async () => {
      setIsLoading(true);
      hasShownScanErrorToast.current = false;

      try {
        if (!hasConfiguredRoots) {
          if (!canceled) {
            startTransition(() => {
              setWorkspaces([]);
              setNotes([]);
              setPinnedNoteIds(new Set());
            });
          }
          return;
        }

        const [cachedResult, cachedPinnedResult] = await Promise.all([
          loadCachedNotes(workspaceSearchSignature),
          loadCachedPinnedNotes(workspaceSearchSignature),
        ]);
        const hasCachedResult = Boolean(cachedResult);

        if ((cachedResult || cachedPinnedResult) && !canceled) {
          startTransition(() => {
            setWorkspaces(cachedResult?.workspaces ?? cachedPinnedResult?.workspaces ?? []);
            setNotes(cachedResult?.notes ?? []);
            setPinnedNoteIds(toPinnedNoteIds(cachedPinnedResult?.notes ?? []));
          });
        } else if (!canceled) {
          startTransition(() => {
            setWorkspaces([]);
            setNotes([]);
            setPinnedNoteIds(new Set());
          });
        }

        const workspaceResult = await loadWorkspaces({ forceRefresh: true });
        if (canceled) {
          return;
        }

        if (!hasCachedResult) {
          startTransition(() => {
            setWorkspaces(workspaceResult.workspaces);
          });
        }

        const [discoveredNotes, pinnedNotes] = await Promise.all([
          scanNotesFromWorkspaces(workspaceResult.workspaces, excludedDirectoryNamesRef.current, showScanFailureToast),
          refreshPinnedNotesCache(
            workspaceResult.workspaces,
            excludedDirectoryNamesRef.current,
            workspaceSearchSignature,
            showScanFailureToast,
          ),
        ]);
        if (canceled) {
          return;
        }

        await saveCachedNotes(workspaceResult.workspaces, discoveredNotes, workspaceSearchSignature);

        startTransition(() => {
          setWorkspaces(workspaceResult.workspaces);
          setNotes(discoveredNotes);
          setPinnedNoteIds(toPinnedNoteIds(pinnedNotes));
        });
      } catch (error) {
        console.error("Failed to scan Octarine notes", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Scan Notes",
        });
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

  const workspaceNames = useMemo(
    () =>
      Array.from(new Set(workspaces.map((workspace) => workspace.name))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [workspaces],
  );
  const matchingNotes = useMemo(
    () =>
      orderNotesByPinnedState(
        notes
          .filter((note) => selectedWorkspace === "all" || note.workspace.name === selectedWorkspace)
          .filter((note) => matchesPathSearch(note, searchText)),
        pinnedNoteIds,
        showPinnedNotesFirst,
      ),
    [notes, pinnedNoteIds, searchText, selectedWorkspace, showPinnedNotesFirst],
  );
  const sections = useMemo(() => buildWorkspaceSections(matchingNotes), [matchingNotes]);
  const searchState = getSearchState({
    isLoading,
    hasConfiguredRoots,
    workspaceCount: workspaces.length,
    noteCount: notes.length,
    visibleNoteCount: matchingNotes.length,
    selectedWorkspace,
  });

  return {
    workspaceNames,
    matchingNotes,
    sections,
    searchState,
    isLoading,
    pinnedNoteIds,
  };
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
