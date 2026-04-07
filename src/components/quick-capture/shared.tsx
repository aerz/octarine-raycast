import { Action, ActionPanel, Detail, Icon, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { SearchNotesEmptyView } from "../empty-views/search-results";
import { WorkspaceNotesEmptyView } from "../empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "../empty-views/workspace";
import { DateFormatsDetail } from "../notifications/date-formats";
import { useNotes } from "../../hooks/useNotes";
import { useWorkspaces } from "../../hooks/useWorkspaces";
import { buildDailyDeskItems, isDailyDeskItem, isSupportedDate, type DailyDeskItem } from "../../lib/daily-desk";
import { type IndexedNote } from "../../lib/notes";
import { openNote } from "../../lib/octarine";
import { match } from "../../utils/match";

type AppendFormValues = {
  content: string;
};

type SearchableNoteItem = IndexedNote | DailyDeskItem;

type NotePickerRenderState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat";

type NotePickerProps = {
  actionTitle: string;
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => ReactElement;
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  onSelectNote: (note: IndexedNote) => Promise<void>;
  searchBarPlaceholder: string;
  workspaceSearchSignature: string;
};

export type QuickCaptureNotePickerProps = {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
};

function getNotePickerRenderState({
  filteredItemCount,
  hasConfiguredRoots,
  hasWorkspaces,
  isLoading,
  noteCount,
  searchText,
  selectedWorkspace,
}: {
  filteredItemCount: number;
  hasConfiguredRoots: boolean;
  hasWorkspaces: boolean;
  isLoading: boolean;
  noteCount: number;
  searchText: string;
  selectedWorkspace: string;
}): NotePickerRenderState {
  if (!hasConfiguredRoots || (!isLoading && !hasWorkspaces)) {
    return "noConfiguredWorkspaces";
  }

  if (searchText.trim().length === 0 && !isLoading && noteCount === 0) {
    return "noAvailableNotes";
  }

  if (!isLoading && searchText.trim().length > 0 && filteredItemCount === 0) {
    return "noMatchingNotes";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function groupItemsByWorkspace(items: SearchableNoteItem[]): Map<string, SearchableNoteItem[]> {
  const groupedItems = new Map<string, SearchableNoteItem[]>();

  for (const item of items) {
    const workspaceName = isDailyDeskItem(item) ? item.workspace : item.workspace.name;
    const itemsInWorkspace = groupedItems.get(workspaceName);

    if (itemsInWorkspace) {
      itemsInWorkspace.push(item);
    } else {
      groupedItems.set(workspaceName, [item]);
    }
  }

  return groupedItems;
}

export async function showCaptureFailureToast(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
}

function NoteListItem({
  actionTitle,
  note,
  onAction,
}: {
  actionTitle: string;
  note: IndexedNote;
  onAction: (note: IndexedNote) => void;
}) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <ActionPanel>
          <Action title={actionTitle} onAction={() => onAction(note)} />
          <Action
            title="Open Note in Octarine"
            icon={Icon.AppWindow}
            onAction={() => void openNote(note.path, note.workspace.name)}
          />
          <Action.CopyToClipboard title="Copy Note Path" content={note.path} />
        </ActionPanel>
      }
    />
  );
}

function DailyDeskListItem({
  actionTitle,
  actionTarget,
  item,
}: {
  actionTitle: string;
  actionTarget: ReactElement;
  item: DailyDeskItem;
}) {
  return (
    <List.Item
      icon={Icon.Calendar}
      title={item.title}
      keywords={[item.title, item.workspace]}
      actions={
        <ActionPanel>
          <Action.Push title={actionTitle} target={actionTarget} />
        </ActionPanel>
      }
    />
  );
}

export function InvalidDailyDeskDateView() {
  return <DateFormatsDetail />;
}

export function AutoCaptureToDailyDeskTarget({
  capture,
  date,
  loadingMarkdown,
}: {
  capture: () => Promise<void>;
  date: string;
  loadingMarkdown: string;
}) {
  const { pop } = useNavigation();
  const hasStartedCapture = useRef(false);
  const isDateValid = isSupportedDate(date);

  useEffect(() => {
    if (!isDateValid || hasStartedCapture.current) {
      return;
    }

    hasStartedCapture.current = true;
    void (async () => {
      await capture();
      pop();
    })();
  }, [capture, isDateValid, pop]);

  if (!isDateValid) {
    return <InvalidDailyDeskDateView />;
  }

  return <Detail isLoading markdown={loadingMarkdown} />;
}

function NotePickerWorkspaceSections({
  actionTitle,
  buildDailyDeskTarget,
  itemsByWorkspace,
  onSelectNote,
  workspaceNames,
}: {
  actionTitle: string;
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => ReactElement;
  itemsByWorkspace: Map<string, SearchableNoteItem[]>;
  onSelectNote: (note: IndexedNote) => Promise<void>;
  workspaceNames: string[];
}) {
  return workspaceNames.map((workspaceName) => {
    const itemsInWorkspace = itemsByWorkspace.get(workspaceName) ?? [];

    if (itemsInWorkspace.length === 0) {
      return null;
    }

    return (
      <List.Section key={workspaceName} title={workspaceName}>
        {itemsInWorkspace.map((item) =>
          isDailyDeskItem(item) ? (
            <DailyDeskListItem
              key={item.id}
              item={item}
              actionTitle={item.title}
              actionTarget={buildDailyDeskTarget(item.workspace, item.date, item.title)}
            />
          ) : (
            <NoteListItem
              key={item.id}
              note={item}
              actionTitle={actionTitle}
              onAction={(selectedNote) => {
                void onSelectNote(selectedNote);
              }}
            />
          ),
        )}
      </List.Section>
    );
  });
}

function NotePickerFlatItems({
  actionTitle,
  buildDailyDeskTarget,
  filteredItems,
  onSelectNote,
}: {
  actionTitle: string;
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => ReactElement;
  filteredItems: SearchableNoteItem[];
  onSelectNote: (note: IndexedNote) => Promise<void>;
}) {
  return filteredItems.map((item) =>
    isDailyDeskItem(item) ? (
      <DailyDeskListItem
        key={item.id}
        item={item}
        actionTitle={item.title}
        actionTarget={buildDailyDeskTarget(item.workspace, item.date, item.title)}
      />
    ) : (
      <NoteListItem
        key={item.id}
        note={item}
        actionTitle={actionTitle}
        onAction={(selectedNote) => {
          void onSelectNote(selectedNote);
        }}
      />
    ),
  );
}

export function NotePicker({
  actionTitle,
  buildDailyDeskTarget,
  excludedDirectoryNames,
  hasConfiguredRoots,
  onSelectNote,
  searchBarPlaceholder,
  workspaceSearchSignature,
}: NotePickerProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaces, status } = useWorkspaces({ enabled: hasConfiguredRoots });
  const { dropdown: workspaceNames, sections, isLoading: isNotesLoading } = useNotes({
    workspaces,
    searchText,
    selectedWorkspace,
    showPinnedNotesFirst: false,
  });
  const matchingNotes = sections.flatMap((section) => section.notes);
  const isLoading = status.isLoading || isNotesLoading;

  const searchableItems = [...matchingNotes, ...buildDailyDeskItems(workspaceNames, searchText)];
  const filteredItems = searchableItems.filter(
    (item) =>
      selectedWorkspace === "all" ||
      (isDailyDeskItem(item) ? item.workspace : item.workspace.name) === selectedWorkspace,
  );
  const itemsByWorkspace = groupItemsByWorkspace(filteredItems);
  const renderState = getNotePickerRenderState({
    filteredItemCount: filteredItems.length,
    hasConfiguredRoots,
    hasWorkspaces: workspaces.length > 0,
    isLoading,
    noteCount: matchingNotes.length,
    searchText,
    selectedWorkspace,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={searchBarPlaceholder}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {match(renderState, {
        noConfiguredWorkspaces: () => <WorkspaceListEmptyView />,
        noAvailableNotes: () => <WorkspaceNotesEmptyView />,
        noMatchingNotes: () => <SearchNotesEmptyView />,
        showByWorkspace: () => (
          <NotePickerWorkspaceSections
            actionTitle={actionTitle}
            buildDailyDeskTarget={buildDailyDeskTarget}
            itemsByWorkspace={itemsByWorkspace}
            onSelectNote={onSelectNote}
            workspaceNames={workspaceNames}
          />
        ),
        showFlat: () => (
          <NotePickerFlatItems
            actionTitle={actionTitle}
            buildDailyDeskTarget={buildDailyDeskTarget}
            filteredItems={filteredItems}
            onSelectNote={onSelectNote}
          />
        ),
      })}
    </List>
  );
}

export function isEmptyAppendContent(values: AppendFormValues): boolean {
  return !values.content.trim();
}
