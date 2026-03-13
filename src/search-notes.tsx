import {
  Action,
  ActionPanel,
  Clipboard,
  List,
  Toast,
  getPreferenceValues,
  open,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { buildOpenNoteUri } from "./lib/octarine";
import type { Workspace } from "./types/octarine";
import {
  IndexedNote,
  loadCachedNotes,
  matchesSearchQuery,
  saveCachedNotes,
  scanNotesFromWorkspaces,
} from "./lib/notes";
import { loadWorkspaces, parseWorkspaceRoots } from "./lib/workspaces";

type SearchNotesPreferences = {
  workspaceRoots: string;
  excludedFolders?: string;
  showWorkspaceNoteCount?: boolean;
};

function renderNoteItem(note: IndexedNote) {
  const octarineUri = buildOpenNoteUri(note.path, note.workspace.name);

  return (
    <List.Item
      key={note.id}
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <ActionPanel>
          <Action
            title="Open Note in Octarine"
            onAction={async () => {
              try {
                await open(octarineUri);
              } catch (error) {
                console.error("Failed to open Octarine note URL", { note, error });
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to Open Note",
                });
              }
            }}
          />
          <Action title="Copy Octarine URL" onAction={() => void Clipboard.copy(octarineUri)} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchNotesCommand() {
  const preferences = getPreferenceValues<SearchNotesPreferences>();
  const showWorkspaceNoteCount = preferences.showWorkspaceNoteCount ?? false;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<IndexedNote[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfiguredRoots, setHasConfiguredRoots] = useState(true);
  const hasShownScanErrorToast = useRef(false);

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
        const preferences = getPreferenceValues<SearchNotesPreferences>();
        const roots = parseWorkspaceRoots(preferences.workspaceRoots);
        const rootsConfigured = roots.length > 0;

        if (!rootsConfigured) {
          if (!canceled) {
            setHasConfiguredRoots(false);
          }
          return;
        }

        if (!canceled) {
          setHasConfiguredRoots(true);
        }

        const cachedResult = await loadCachedNotes();
        const hasCachedResult = Boolean(cachedResult);

        if (cachedResult && !canceled) {
          startTransition(() => {
            setWorkspaces(cachedResult.workspaces);
            setNotes(cachedResult.notes);
          });
        } else {
          startTransition(() => {
            setNotes([]);
            setWorkspaces([]);
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

        const discoveredNotes = await scanNotesFromWorkspaces(workspaceResult.workspaces, showScanFailureToast);
        if (canceled) {
          return;
        }

        await saveCachedNotes(workspaceResult.workspaces, discoveredNotes);

        startTransition(() => {
          setWorkspaces(workspaceResult.workspaces);
          setNotes(discoveredNotes);
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
  }, []);

  const workspaceNames = useMemo(
    () =>
      Array.from(new Set(workspaces.map((workspace) => workspace.name))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [workspaces],
  );

  const filteredNotes = useMemo(
    () => notes.filter((note) => selectedWorkspace === "all" || note.workspace.name === selectedWorkspace),
    [notes, selectedWorkspace],
  );

  const searchFilteredNotes = useMemo(
    () => filteredNotes.filter((note) => matchesSearchQuery(note, searchText)),
    [filteredNotes, searchText],
  );

  const notesByWorkspace = useMemo(() => {
    const groupedNotes = new Map<string, IndexedNote[]>();
    for (const note of searchFilteredNotes) {
      const workspaceName = note.workspace.name;
      const notesInWorkspace = groupedNotes.get(workspaceName);
      if (notesInWorkspace) {
        notesInWorkspace.push(note);
      } else {
        groupedNotes.set(workspaceName, [note]);
      }
    }

    return groupedNotes;
  }, [searchFilteredNotes]);

  const showNoWorkspacesConfigured = !isLoading && !hasConfiguredRoots;
  const showNoValidWorkspaces = !isLoading && hasConfiguredRoots && workspaces.length === 0;
  const showNoNotesFound = !isLoading && workspaces.length > 0 && notes.length === 0;
  const showNoMatchingNotes =
    !isLoading &&
    !showNoWorkspacesConfigured &&
    !showNoValidWorkspaces &&
    !showNoNotesFound &&
    searchFilteredNotes.length === 0;

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Octarine notes..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {showNoWorkspacesConfigured ? (
        <List.EmptyView
          title="No Workspaces Configured"
          description="Open extension preferences and set Workspace Root Paths."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={() => void openCommandPreferences()} />
            </ActionPanel>
          }
        />
      ) : null}
      {showNoValidWorkspaces ? (
        <List.EmptyView
          title="No Valid Workspaces Discovered"
          description="A valid workspace must contain a .octarine folder."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={() => void openCommandPreferences()} />
            </ActionPanel>
          }
        />
      ) : null}
      {showNoNotesFound ? <List.EmptyView title="No Notes Found" /> : null}
      {showNoMatchingNotes ? <List.EmptyView title="No Matching Notes" /> : null}
      {!showNoWorkspacesConfigured && !showNoValidWorkspaces && !showNoNotesFound && !showNoMatchingNotes
        ? selectedWorkspace === "all"
          ? workspaceNames.map((workspaceName) => {
              const notesInWorkspace = notesByWorkspace.get(workspaceName) ?? [];
              if (notesInWorkspace.length === 0) {
                return null;
              }

              return (
                <List.Section
                  key={workspaceName}
                  title={showWorkspaceNoteCount ? `${workspaceName} (${notesInWorkspace.length})` : workspaceName}
                >
                  {notesInWorkspace.map((note) => renderNoteItem(note))}
                </List.Section>
              );
            })
          : searchFilteredNotes.map((note) => renderNoteItem(note))
        : null}
    </List>
  );
}
