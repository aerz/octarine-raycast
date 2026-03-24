import { List } from "@raycast/api";
import { useMemo, useState } from "react";
import { PinnedNoteActions } from "./components/PinnedNoteActions";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { usePinnedNotes } from "./hooks/usePinnedNotes";
import { getSearchPinnedNotesPreferences } from "./lib/preferences";
import { IndexedNote, matchesSearchQuery } from "./lib/notes";

type ViewState = "loading" | "workspace-not-found" | "no-notes" | "no-matching-notes" | "results";

function assertNever(value: never): never {
  throw new Error(`Unhandled view state: ${String(value)}`);
}

function getViewState({
  isLoading,
  hasConfiguredRoots,
  workspaceCount,
  noteCount,
  filteredWorkspaceSections,
}: {
  isLoading: boolean;
  hasConfiguredRoots: boolean;
  workspaceCount: number;
  noteCount: number;
  filteredWorkspaceSections: { notes: IndexedNote[] }[];
}): ViewState {
  if (isLoading) {
    return "loading";
  }

  if (!hasConfiguredRoots || workspaceCount === 0) {
    return "workspace-not-found";
  }

  if (noteCount === 0) {
    return "no-notes";
  }

  const visibleNoteCount = filteredWorkspaceSections.reduce(
    (count, workspaceSection) => count + workspaceSection.notes.length,
    0,
  );
  if (visibleNoteCount === 0) {
    return "no-matching-notes";
  }

  return "results";
}

function PinnedNoteItem({ note }: { note: IndexedNote }) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={<PinnedNoteActions note={note} />}
    />
  );
}

export default function SearchPinnedNotesCommand() {
  const preferences = getSearchPinnedNotesPreferences();
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaces, notes, workspaceSections, isLoading } = usePinnedNotes(preferences);

  const filteredWorkspaceSections = useMemo(
    () =>
      workspaceSections
        .filter(
          (workspaceSection) => selectedWorkspace === "all" || workspaceSection.workspacePath === selectedWorkspace,
        )
        .map((workspaceSection) => ({
          workspacePath: workspaceSection.workspacePath,
          workspaceName: workspaceSection.workspaceName,
          notes: workspaceSection.notes.filter((note) => matchesSearchQuery(note, searchText)),
        }))
        .filter((workspaceSection) => workspaceSection.notes.length > 0),
    [searchText, selectedWorkspace, workspaceSections],
  );
  const viewState = getViewState({
    isLoading,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
    workspaceCount: workspaces.length,
    noteCount: notes.length,
    filteredWorkspaceSections,
  });

  function renderContent() {
    switch (viewState) {
      case "loading":
        return null;
      case "workspace-not-found":
        return <WorkspaceNotFound />;
      case "no-notes":
        return <WorkspaceContentEmptyView resource="notes" />;
      case "no-matching-notes":
        return <SearchResultsEmptyView resource="notes" />;
      case "results":
        if (selectedWorkspace !== "all") {
          return filteredWorkspaceSections.flatMap((workspaceSection) =>
            workspaceSection.notes.map((note) => <PinnedNoteItem key={note.id} note={note} />),
          );
        }

        return filteredWorkspaceSections.map((workspaceSection) => (
          <List.Section
            key={workspaceSection.workspacePath}
            title={
              preferences.showWorkspaceNoteCount
                ? `${workspaceSection.workspaceName} (${workspaceSection.notes.length})`
                : workspaceSection.workspaceName
            }
          >
            {workspaceSection.notes.map((note) => (
              <PinnedNoteItem key={note.id} note={note} />
            ))}
          </List.Section>
        ));
      default:
        return assertNever(viewState);
    }
  }

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search pinned notes..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceSections.map((workspaceSection) => (
            <List.Dropdown.Item
              key={workspaceSection.workspacePath}
              title={workspaceSection.workspaceName}
              value={workspaceSection.workspacePath}
            />
          ))}
        </List.Dropdown>
      }
    >
      {renderContent()}
    </List>
  );
}
