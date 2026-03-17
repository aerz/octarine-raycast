import { Action, ActionPanel, Clipboard, List, Toast, showToast } from "@raycast/api";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { SearchResultsEmptyView } from "./components/empty-views/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/empty-views/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/empty-views/WorkspaceNotFound";
import { buildOpenNoteUri, openOctarineUri } from "./lib/octarine";
import { getSearchNotesPreferences } from "./lib/preferences";
import type { Workspace } from "./types/octarine";
import {
  IndexedNote,
  loadCachedNotes,
  matchesSearchQuery,
  saveCachedNotes,
  scanNotesFromWorkspaces,
} from "./lib/notes";
import { loadWorkspaces } from "./lib/workspaces";

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
          <Action title="Open Note in Octarine" onAction={() => void openOctarineUri(octarineUri)} />
          <Action title="Copy Octarine URL" onAction={() => void Clipboard.copy(octarineUri)} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchNotesCommand() {
  const preferences = useMemo(() => getSearchNotesPreferences(), []);
  const { extension: extensionPreferences, showWorkspaceNoteCount } = preferences;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<IndexedNote[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfiguredRoots, setHasConfiguredRoots] = useState(extensionPreferences.hasConfiguredRoots);
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
        if (!extensionPreferences.hasConfiguredRoots) {
          if (!canceled) {
            setHasConfiguredRoots(false);
          }
          return;
        }

        if (!canceled) {
          setHasConfiguredRoots(true);
        }

        const cachedResult = await loadCachedNotes(extensionPreferences.workspaceSearchSignature);
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

        const discoveredNotes = await scanNotesFromWorkspaces(
          workspaceResult.workspaces,
          extensionPreferences.excludedFoldersInWorkspaces,
          showScanFailureToast,
        );
        if (canceled) {
          return;
        }

        await saveCachedNotes(
          workspaceResult.workspaces,
          discoveredNotes,
          extensionPreferences.workspaceSearchSignature,
        );

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
  }, [
    extensionPreferences.excludedFoldersInWorkspaces,
    extensionPreferences.hasConfiguredRoots,
    extensionPreferences.workspaceSearchSignature,
  ]);

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

  const showWorkspaceNotFound = !isLoading && (!hasConfiguredRoots || workspaces.length === 0);
  const showNoNotesFound = !isLoading && !showWorkspaceNotFound && notes.length === 0;
  const showNoMatchingNotes =
    !isLoading && !showWorkspaceNotFound && !showNoNotesFound && searchFilteredNotes.length === 0;

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
      {showWorkspaceNotFound ? <WorkspaceNotFound /> : null}
      {showNoNotesFound ? <WorkspaceContentEmptyView resource="notes" /> : null}
      {showNoMatchingNotes ? <SearchResultsEmptyView resource="notes" /> : null}
      {!showWorkspaceNotFound && !showNoNotesFound && !showNoMatchingNotes
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
