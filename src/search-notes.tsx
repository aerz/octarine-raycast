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
import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import { Workspace, loadWorkspaces, parseWorkspaceRoots } from "./lib/workspaces";

interface OctarineNote {
  id: string;
  title: string;
  subtitle: string;
  workspace: string;
}

const EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);

function normalizeSearchPart(searchPart: string): string {
  return searchPart.trim().toLowerCase().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function toPathSegments(pathValue: string): string[] {
  return pathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesDirectoryScopeAtAnyDepth(noteDirectory: string, directoryQuery: string): boolean {
  const querySegments = toPathSegments(directoryQuery);
  if (querySegments.length === 0) {
    return true;
  }

  const directorySegments = toPathSegments(noteDirectory);
  if (directorySegments.length < querySegments.length) {
    return false;
  }

  for (let start = 0; start <= directorySegments.length - querySegments.length; start += 1) {
    let matchesAllSegments = true;

    for (let index = 0; index < querySegments.length; index += 1) {
      if (directorySegments[start + index] !== querySegments[index]) {
        matchesAllSegments = false;
        break;
      }
    }

    if (matchesAllSegments) {
      return true;
    }
  }

  return false;
}

function matchesSearchQuery(note: OctarineNote, searchText: string): boolean {
  const normalizedQuery = normalizeSearchPart(searchText);
  if (!normalizedQuery) {
    return true;
  }

  const noteTitle = note.title.toLowerCase();
  const noteSubtitle = note.subtitle.toLowerCase();
  const noteWorkspace = note.workspace.toLowerCase();
  const noteDirectory = path.posix.dirname(noteSubtitle);
  const normalizedDirectory = noteDirectory === "." ? "" : noteDirectory;
  const hasSlash = normalizedQuery.includes("/");

  if (!hasSlash) {
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }

    const combinedHaystack = `${noteTitle} ${noteSubtitle} ${noteWorkspace}`;
    return tokens.every((token) => combinedHaystack.includes(token));
  }

  const hasTrailingSlash = normalizedQuery.endsWith("/");
  const queryWithoutOuterSlashes = normalizedQuery.replace(/^\/+|\/+$/g, "");

  if (hasTrailingSlash) {
    return matchesDirectoryScopeAtAnyDepth(normalizedDirectory, queryWithoutOuterSlashes);
  }

  const fuzzyPathMatch =
    normalizedDirectory.includes(queryWithoutOuterSlashes) || noteSubtitle.includes(queryWithoutOuterSlashes);

  const lastSlashIndex = queryWithoutOuterSlashes.lastIndexOf("/");
  const directoryPrefix = lastSlashIndex === -1 ? "" : queryWithoutOuterSlashes.slice(0, lastSlashIndex).trim();
  const titleQuery =
    lastSlashIndex === -1 ? queryWithoutOuterSlashes : queryWithoutOuterSlashes.slice(lastSlashIndex + 1).trim();
  const titleTokens = titleQuery.split(/\s+/).filter(Boolean);

  const scopedTitleMatch =
    matchesDirectoryScopeAtAnyDepth(normalizedDirectory, directoryPrefix) &&
    (titleTokens.length === 0 || titleTokens.every((token) => noteTitle.includes(token)));

  return fuzzyPathMatch || scopedTitleMatch;
}

function toPosixPath(inputPath: string): string {
  return inputPath.split(path.sep).join(path.posix.sep);
}

function buildOctarineUrl(note: OctarineNote): string {
  return `octarine://open?path=${encodeURIComponent(note.subtitle)}&workspace=${encodeURIComponent(note.workspace)}`;
}

async function scanWorkspaceForNotes(
  workspace: Workspace,
  onDiscoveredNote: (note: OctarineNote) => void,
  onError: (error: unknown) => Promise<void>,
): Promise<void> {
  const pendingDirectories: string[] = [workspace.path];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      console.error("Failed to read directory during note scan", {
        workspace: workspace.path,
        directory: currentDirectory,
        error,
      });
      await onError(error);
      continue;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name) && entry.isDirectory()) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
        continue;
      }

      const relativePath = toPosixPath(path.relative(workspace.path, absolutePath));
      const noteTitle = path.basename(entry.name, ".md");

      onDiscoveredNote({
        id: `${workspace.name}::${relativePath}`,
        title: noteTitle,
        subtitle: relativePath,
        workspace: workspace.name,
      });
    }
  }
}

function renderNoteItem(note: OctarineNote) {
  const octarineUrl = buildOctarineUrl(note);

  return (
    <List.Item
      key={note.id}
      title={note.title}
      subtitle={note.subtitle}
      keywords={[note.subtitle, note.workspace]}
      actions={
        <ActionPanel>
          <Action
            title="Open Note in Octarine"
            onAction={async () => {
              try {
                await open(octarineUrl);
              } catch (error) {
                console.error("Failed to open Octarine note URL", { note, error });
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to Open Note",
                });
              }
            }}
          />
          <Action title="Copy Octarine URL" onAction={() => void Clipboard.copy(octarineUrl)} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchNotesCommand() {
  const preferences = getPreferenceValues<{ showWorkspaceNoteCount?: boolean }>();
  const showWorkspaceNoteCount = preferences.showWorkspaceNoteCount ?? false;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<OctarineNote[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfiguredRoots, setHasConfiguredRoots] = useState(true);
  const hasShownScanErrorToast = useRef(false);

  useEffect(() => {
    let canceled = false;
    const discoveredNoteIds = new Set<string>();

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
      setNotes([]);
      setWorkspaces([]);
      hasShownScanErrorToast.current = false;

      try {
        const preferences = getPreferenceValues<Preferences>();
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

        const workspaceResult = await loadWorkspaces();
        if (canceled) {
          return;
        }

        setWorkspaces(workspaceResult.workspaces);

        for (const workspace of workspaceResult.workspaces) {
          await scanWorkspaceForNotes(
            workspace,
            (note) => {
              if (canceled || discoveredNoteIds.has(note.id)) {
                return;
              }

              discoveredNoteIds.add(note.id);
              setNotes((previousNotes) => {
                const nextNotes = [...previousNotes, note];
                nextNotes.sort((left, right) => {
                  const byWorkspace = left.workspace.localeCompare(right.workspace);
                  if (byWorkspace !== 0) {
                    return byWorkspace;
                  }

                  return left.subtitle.localeCompare(right.subtitle);
                });
                return nextNotes;
              });
            },
            showScanFailureToast,
          );
        }
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
    () => notes.filter((note) => selectedWorkspace === "all" || note.workspace === selectedWorkspace),
    [notes, selectedWorkspace],
  );

  const searchFilteredNotes = useMemo(
    () => filteredNotes.filter((note) => matchesSearchQuery(note, searchText)),
    [filteredNotes, searchText],
  );

  const notesByWorkspace = useMemo(() => {
    const groupedNotes = new Map<string, OctarineNote[]>();
    for (const note of searchFilteredNotes) {
      const notesInWorkspace = groupedNotes.get(note.workspace);
      if (notesInWorkspace) {
        notesInWorkspace.push(note);
      } else {
        groupedNotes.set(note.workspace, [note]);
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
