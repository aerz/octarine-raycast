import {
  Action,
  ActionPanel,
  BrowserExtension,
  Detail,
  Form,
  Icon,
  List,
  Toast,
  Clipboard,
  environment,
  getSelectedText,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import path from "node:path";
import { DateFormatsDetail } from "./components/Notifications/DateFormatsDetail";
import { CollectionEmptyView } from "./components/EmptyViews/CollectionEmptyView";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { useNotes } from "./hooks/useNotes";
import { isSupportedDailyDeskDate } from "./lib/daily-desk";
import { IndexedNote, IndexedNoteFolder, scanNoteFoldersFromWorkspaces } from "./lib/notes";
import { appendDailyNoteContent, openNote, upsertOctarineNoteContent } from "./lib/octarine";
import { getExtensionPreferences } from "./lib/preferences";
import { buildSearchIndexText, matchesSearchIndex } from "./lib/search";
import { match } from "./utils/match";
import { loadWorkspaces } from "./lib/workspaces";
import type { Workspace } from "./types/octarine";

type AppendForm = {
  content: string;
};

type FolderPickerProps = {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
};

type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  searchIndex: string;
  title: string;
  workspaceName: string;
};

type SearchableNoteItem = IndexedNote | DailyDeskItem;

type NotePickerProps = {
  actionTitle: string;
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => React.ReactElement;
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  onSelectNote: (note: IndexedNote) => Promise<void>;
  searchBarPlaceholder: string;
  workspaceSearchSignature: string;
};

type NotePickerRenderState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat";

type FolderPickerRenderState = "noConfiguredWorkspaces" | "noMatchingFolders" | "showByWorkspace" | "showFlat";

type QuickCaptureRenderState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat"
  | "showByWorkspaceWithQuickCapture"
  | "showFlatWithQuickCapture";

export default function QuickCaptureCommand() {
  const preferences = getExtensionPreferences();
  const excludedDirectoryNames = useMemo(
    () => preferences.excludedFoldersInWorkspaces,
    [preferences.workspaceSearchSignature],
  );
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaceNames, matchingNotes, searchState, isLoading } = useNotes({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames,
    workspaceSearchSignature: preferences.workspaceSearchSignature,
    hasConfiguredRoots: preferences.hasConfiguredRoots,
    showPinnedNotesFirst: false,
  });
  const searchableItems = useMemo(
    () => [...matchingNotes, ...buildDailyDeskItems(workspaceNames, searchText)],
    [matchingNotes, searchText, workspaceNames],
  );
  const filteredItems = useMemo(
    () =>
      searchableItems.filter(
        (item) =>
          selectedWorkspace === "all" ||
          (isDailyDeskItem(item) ? item.workspaceName : item.workspace.name) === selectedWorkspace,
      ),
    [searchableItems, selectedWorkspace],
  );
  const itemsByWorkspace = useMemo(() => groupItemsByWorkspace(filteredItems), [filteredItems]);
  const showStaticActions = searchText.trim().length === 0;
  const renderState = getQuickCaptureRenderState({
    filteredItemCount: filteredItems.length,
    isLoading,
    searchState,
    selectedWorkspace,
    showStaticActions,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search notes or type a date..."
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
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noAvailableNotes: () => <WorkspaceContentEmptyView resource="notes" />,
        noMatchingNotes: () => <SearchResultsEmptyView resource="notes" />,
        showByWorkspaceWithQuickCapture: () => (
          <QuickCaptureWithWorkspaceSections
            excludedDirectoryNames={excludedDirectoryNames}
            hasConfiguredRoots={preferences.hasConfiguredRoots}
            itemsByWorkspace={itemsByWorkspace}
            workspaceNames={workspaceNames}
            workspaceSearchSignature={preferences.workspaceSearchSignature}
          />
        ),
        showByWorkspace: () => (
          <WorkspaceSections itemsByWorkspace={itemsByWorkspace} workspaceNames={workspaceNames} />
        ),
        showFlatWithQuickCapture: () => (
          <QuickCaptureWithNotes
            excludedDirectoryNames={excludedDirectoryNames}
            filteredItems={filteredItems}
            hasConfiguredRoots={preferences.hasConfiguredRoots}
            workspaceSearchSignature={preferences.workspaceSearchSignature}
          />
        ),
        showFlat: () => <FlatItems filteredItems={filteredItems} />,
      })}
    </List>
  );
}

function getNotePickerRenderState({
  filteredItemCount,
  isLoading,
  searchState,
  searchText,
  selectedWorkspace,
}: {
  filteredItemCount: number;
  isLoading: boolean;
  searchState:
    | "loading"
    | "noConfiguredWorkspaces"
    | "noAvailableNotes"
    | "noMatchingNotes"
    | "showByWorkspace"
    | "showFlat";
  searchText: string;
  selectedWorkspace: string;
}): NotePickerRenderState {
  if (searchState === "noConfiguredWorkspaces") {
    return "noConfiguredWorkspaces";
  }

  if (searchText.trim().length === 0 && searchState === "noAvailableNotes") {
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

function getFolderPickerRenderState({
  hasWorkspaces,
  isLoading,
  searchFilteredFolderCount,
  selectedWorkspace,
}: {
  hasWorkspaces: boolean;
  isLoading: boolean;
  searchFilteredFolderCount: number;
  selectedWorkspace: string;
}): FolderPickerRenderState {
  if (!isLoading && !hasWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (!isLoading && searchFilteredFolderCount === 0) {
    return "noMatchingFolders";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function getQuickCaptureRenderState({
  filteredItemCount,
  isLoading,
  searchState,
  selectedWorkspace,
  showStaticActions,
}: {
  filteredItemCount: number;
  isLoading: boolean;
  searchState:
    | "loading"
    | "noConfiguredWorkspaces"
    | "noAvailableNotes"
    | "noMatchingNotes"
    | "showByWorkspace"
    | "showFlat";
  selectedWorkspace: string;
  showStaticActions: boolean;
}): QuickCaptureRenderState {
  if (searchState === "noConfiguredWorkspaces") {
    return "noConfiguredWorkspaces";
  }

  if (showStaticActions && searchState === "noAvailableNotes") {
    return "noAvailableNotes";
  }

  if (!showStaticActions && !isLoading && filteredItemCount === 0) {
    return "noMatchingNotes";
  }

  if (showStaticActions && selectedWorkspace === "all") {
    return "showByWorkspaceWithQuickCapture";
  }

  if (showStaticActions) {
    return "showFlatWithQuickCapture";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function groupFoldersByWorkspace(folders: IndexedNoteFolder[]): Map<string, IndexedNoteFolder[]> {
  const groupedFolders = new Map<string, IndexedNoteFolder[]>();

  for (const folder of folders) {
    const workspaceName = folder.workspace.name;
    const foldersInWorkspace = groupedFolders.get(workspaceName);

    if (foldersInWorkspace) {
      foldersInWorkspace.push(folder);
    } else {
      groupedFolders.set(workspaceName, [folder]);
    }
  }

  return groupedFolders;
}

function groupItemsByWorkspace(items: SearchableNoteItem[]): Map<string, SearchableNoteItem[]> {
  const groupedItems = new Map<string, SearchableNoteItem[]>();

  for (const item of items) {
    const workspaceName = isDailyDeskItem(item) ? item.workspaceName : item.workspace.name;
    const itemsInWorkspace = groupedItems.get(workspaceName);

    if (itemsInWorkspace) {
      itemsInWorkspace.push(item);
    } else {
      groupedItems.set(workspaceName, [item]);
    }
  }

  return groupedItems;
}

function buildNotePath(directoryPath: string, fileName: string): string {
  const normalizedFileName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  return directoryPath ? path.posix.join(directoryPath, normalizedFileName) : normalizedFileName;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return sanitized || "Website Capture";
}

function buildWebsiteCaptureFileName(tabTitle?: string, tabUrl?: string): string {
  const fallbackTitle = (() => {
    if (!tabUrl) {
      return "Website Capture";
    }

    try {
      return new URL(tabUrl).hostname || "Website Capture";
    } catch {
      return "Website Capture";
    }
  })();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeFileName(tabTitle || fallbackTitle)} ${timestamp}`;
}

async function showCaptureFailureToast(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
}

async function appendContentToNote(
  note: IndexedNote,
  content: string,
  loadingTitle: string,
  successTitle: string,
): Promise<void> {
  const loadingToast = await showToast({
    style: Toast.Style.Animated,
    title: loadingTitle,
  });

  const didOpen = await upsertOctarineNoteContent({
    path: note.path,
    workspaceName: note.workspace.name,
    content,
  });

  if (!didOpen) {
    await loadingToast.hide();
    return;
  }

  loadingToast.style = Toast.Style.Success;
  loadingToast.title = successTitle;
}

async function appendContentToDailyTarget(
  workspaceName: string,
  date: string,
  content: string,
  loadingTitle: string,
  successTitle: string,
): Promise<void> {
  const loadingToast = await showToast({
    style: Toast.Style.Animated,
    title: loadingTitle,
  });

  const didOpen = await appendDailyNoteContent({
    date,
    workspaceName,
    content,
  });

  if (!didOpen) {
    await loadingToast.hide();
    return;
  }

  loadingToast.style = Toast.Style.Success;
  loadingToast.title = successTitle;
}

function NoteListItem({
  actionTitle,
  actionTarget,
  note,
  onAction,
}: {
  actionTitle: string;
  actionTarget?: React.ReactElement;
  note: IndexedNote;
  onAction?: (note: IndexedNote) => void;
}) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <ActionPanel>
          {actionTarget ? (
            <Action.Push title={actionTitle} target={actionTarget} />
          ) : (
            <Action title={actionTitle} onAction={() => onAction?.(note)} />
          )}
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

function isDailyDeskItem(item: SearchableNoteItem): item is DailyDeskItem {
  return "kind" in item && item.kind === "daily-desk";
}

function normalizeWorkspacePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findScopedWorkspaceMatch(
  workspaceNames: string[],
  searchText: string,
): { date: string; matchedWorkspaceNames: string[] } | undefined {
  const trimmedSearchText = searchText.trim();
  const queryTokens = trimmedSearchText.split(/\s+/).filter(Boolean);

  for (let tokenCount = queryTokens.length - 1; tokenCount >= 1; tokenCount -= 1) {
    const workspacePrefix = queryTokens.slice(0, tokenCount).join(" ");
    const normalizedWorkspacePrefix = normalizeWorkspacePhrase(workspacePrefix);
    const date = trimmedSearchText.slice(workspacePrefix.length).trim();

    if (!date) {
      continue;
    }

    const matchedWorkspaceNames = workspaceNames.filter((workspaceName) => {
      const normalizedWorkspaceName = normalizeWorkspacePhrase(workspaceName);
      return (
        normalizedWorkspaceName === normalizedWorkspacePrefix ||
        normalizedWorkspaceName.startsWith(`${normalizedWorkspacePrefix} `)
      );
    });

    if (matchedWorkspaceNames.length > 0) {
      return { date, matchedWorkspaceNames };
    }
  }

  return undefined;
}

function buildDailyDeskItems(workspaceNames: string[], searchText: string): DailyDeskItem[] {
  const trimmedSearchText = searchText.trim();
  if (!trimmedSearchText) {
    return [];
  }

  const scopedMatch = findScopedWorkspaceMatch(workspaceNames, trimmedSearchText);
  if (scopedMatch) {
    return scopedMatch.matchedWorkspaceNames.map((workspaceName) => {
      const title = `Use "${scopedMatch.date}" in Daily Desk`;

      return {
        date: scopedMatch.date,
        id: `daily-desk::${workspaceName}::${scopedMatch.date}`,
        kind: "daily-desk" as const,
        searchIndex: buildSearchIndexText(title, "Daily Desk", workspaceName),
        title,
        workspaceName,
      };
    });
  }

  return workspaceNames.map((workspaceName) => {
    const title = `Use "${trimmedSearchText}" in Daily Desk`;

    return {
      date: trimmedSearchText,
      id: `daily-desk::${workspaceName}::${trimmedSearchText}`,
      kind: "daily-desk" as const,
      searchIndex: buildSearchIndexText(title, "Daily Desk", workspaceName),
      title,
      workspaceName,
    };
  });
}

function DailyDeskListItem({
  actionTitle,
  actionTarget,
  item,
  onAction,
}: {
  actionTitle: string;
  actionTarget?: React.ReactElement;
  item: DailyDeskItem;
  onAction?: (workspaceName: string) => void;
}) {
  return (
    <List.Item
      icon={Icon.Calendar}
      title={item.title}
      keywords={[item.title, item.workspaceName]}
      actions={
        <ActionPanel>
          {actionTarget ? (
            <Action.Push title={actionTitle} target={actionTarget} />
          ) : (
            <Action title={actionTitle} onAction={() => onAction?.(item.workspaceName)} />
          )}
        </ActionPanel>
      }
    />
  );
}

function InvalidDailyDeskDateView() {
  const hasShownDateErrorToast = useRef(false);

  useEffect(() => {
    if (hasShownDateErrorToast.current) {
      return;
    }

    hasShownDateErrorToast.current = true;
    void showCaptureFailureToast("Invalid date", "Use a supported Octarine date format");
  }, []);

  return <DateFormatsDetail />;
}

function AppendToNoteForm({ note }: { note: IndexedNote }) {
  async function handleSubmit(values: AppendForm) {
    if (!values.content.trim()) {
      await showCaptureFailureToast("Nothing to Append", "Enter some text before submitting.");
      return;
    }

    await appendContentToNote(note, values.content, "Appending to Note…", "Content Appended");
  }

  return (
    <Form
      navigationTitle={`Append to ${note.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Append to Note" onSubmit={(values) => void handleSubmit(values as AppendForm)} />
        </ActionPanel>
      }
    >
      <Form.Description text={`${note.workspace.name} / ${note.path}`} />
      <Form.TextArea id="content" title="Content" placeholder="Write something to append to this note..." />
    </Form>
  );
}

function AppendToDailyNoteForm({ workspaceName, date, title }: { workspaceName: string; date: string; title: string }) {
  const isDateValid = useMemo(() => isSupportedDailyDeskDate(date), [date]);

  async function handleSubmit(values: AppendForm) {
    if (!values.content.trim()) {
      await showCaptureFailureToast("Nothing to Append", "Enter some text before submitting.");
      return;
    }

    await appendContentToDailyTarget(
      workspaceName,
      date,
      values.content,
      `Appending to ${title}…`,
      `Content Appended to ${title}`,
    );
  }

  if (!isDateValid) {
    return <InvalidDailyDeskDateView />;
  }

  return (
    <Form
      navigationTitle={`Append to ${title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={`Append to ${title}`}
            onSubmit={(values) => void handleSubmit(values as AppendForm)}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={`${workspaceName} / ${title}`} />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder={`Write something to append to ${title.toLowerCase()}...`}
      />
    </Form>
  );
}

function AutoCaptureToDailyDeskTarget({
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
  const isDateValid = useMemo(() => isSupportedDailyDeskDate(date), [date]);

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
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => React.ReactElement;
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
              actionTarget={buildDailyDeskTarget(item.workspaceName, item.date, item.title)}
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
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => React.ReactElement;
  filteredItems: SearchableNoteItem[];
  onSelectNote: (note: IndexedNote) => Promise<void>;
}) {
  return filteredItems.map((item) =>
    isDailyDeskItem(item) ? (
      <DailyDeskListItem
        key={item.id}
        item={item}
        actionTitle={item.title}
        actionTarget={buildDailyDeskTarget(item.workspaceName, item.date, item.title)}
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

function NotePicker({
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
  const { workspaceNames, matchingNotes, searchState, isLoading } = useNotes({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames,
    workspaceSearchSignature,
    hasConfiguredRoots,
    showPinnedNotesFirst: false,
  });

  const searchableItems = useMemo(
    () => [...matchingNotes, ...buildDailyDeskItems(workspaceNames, searchText)],
    [matchingNotes, searchText, workspaceNames],
  );
  const filteredItems = useMemo(
    () =>
      searchableItems.filter(
        (item) =>
          selectedWorkspace === "all" ||
          (isDailyDeskItem(item) ? item.workspaceName : item.workspace.name) === selectedWorkspace,
      ),
    [searchableItems, selectedWorkspace],
  );
  const itemsByWorkspace = useMemo(() => groupItemsByWorkspace(filteredItems), [filteredItems]);
  const renderState = getNotePickerRenderState({
    filteredItemCount: filteredItems.length,
    isLoading,
    searchState,
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
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noAvailableNotes: () => <WorkspaceContentEmptyView resource="notes" />,
        noMatchingNotes: () => <SearchResultsEmptyView resource="notes" />,
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

function ClipboardCapturePicker({
  excludedDirectoryNames,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
}) {
  async function handleSelectNote(note: IndexedNote) {
    const clipboardText = await Clipboard.readText();

    if (!clipboardText?.trim()) {
      await showCaptureFailureToast("Clipboard Is Empty", "Copy some text and try again.");
      return;
    }

    await appendContentToNote(note, clipboardText, "Capturing Clipboard…", "Clipboard Captured");
  }

  return (
    <NotePicker
      actionTitle="Append Clipboard to Note"
      buildDailyDeskTarget={(workspaceName, date) => (
        <AutoCaptureToDailyDeskTarget
          date={date}
          loadingMarkdown="# Capturing Clipboard…"
          capture={async () => {
            const clipboardText = await Clipboard.readText();

            if (!clipboardText?.trim()) {
              await showCaptureFailureToast("Clipboard Is Empty", "Copy some text and try again.");
              return;
            }

            await appendContentToDailyTarget(
              workspaceName,
              date,
              clipboardText,
              `Capturing Clipboard to ${date}…`,
              `Clipboard Captured to ${date}`,
            );
          }}
        />
      )}
      excludedDirectoryNames={excludedDirectoryNames}
      hasConfiguredRoots={hasConfiguredRoots}
      onSelectNote={handleSelectNote}
      searchBarPlaceholder="Search notes or type a date for clipboard..."
      workspaceSearchSignature={workspaceSearchSignature}
    />
  );
}

function SelectedTextCapturePicker({
  excludedDirectoryNames,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
}) {
  async function handleSelectNote(note: IndexedNote) {
    let selectedText: string;

    try {
      selectedText = await getSelectedText();
    } catch (error) {
      await showCaptureFailureToast(
        "No Selected Text",
        error instanceof Error ? error.message : "Select some text in the frontmost app and try again.",
      );
      return;
    }

    if (!selectedText.trim()) {
      await showCaptureFailureToast("No Selected Text", "Select some text in the frontmost app and try again.");
      return;
    }

    await appendContentToNote(note, selectedText, "Capturing Selected Text…", "Selected Text Captured");
  }

  return (
    <NotePicker
      actionTitle="Append Selected Text to Note"
      buildDailyDeskTarget={(workspaceName, date) => (
        <AutoCaptureToDailyDeskTarget
          date={date}
          loadingMarkdown="# Capturing Selected Text…"
          capture={async () => {
            let selectedText: string;

            try {
              selectedText = await getSelectedText();
            } catch (error) {
              await showCaptureFailureToast(
                "No Selected Text",
                error instanceof Error ? error.message : "Select some text in the frontmost app and try again.",
              );
              return;
            }

            if (!selectedText.trim()) {
              await showCaptureFailureToast("No Selected Text", "Select some text in the frontmost app and try again.");
              return;
            }

            await appendContentToDailyTarget(
              workspaceName,
              date,
              selectedText,
              `Capturing Selected Text to ${date}…`,
              `Selected Text Captured to ${date}`,
            );
          }}
        />
      )}
      excludedDirectoryNames={excludedDirectoryNames}
      hasConfiguredRoots={hasConfiguredRoots}
      onSelectNote={handleSelectNote}
      searchBarPlaceholder="Search notes or type a date for selected text..."
      workspaceSearchSignature={workspaceSearchSignature}
    />
  );
}

function WebsiteCaptureFolderPicker({ excludedDirectoryNames, hasConfiguredRoots }: FolderPickerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<IndexedNoteFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
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
        title: "Failed to Scan Some Folders",
      });
    };

    const scanFolders = async () => {
      setIsLoading(true);
      hasShownScanErrorToast.current = false;

      try {
        if (!hasConfiguredRoots) {
          if (!canceled) {
            setWorkspaces([]);
            setFolders([]);
          }
          return;
        }

        const workspaceResult = await loadWorkspaces({ forceRefresh: true });
        if (!canceled) {
          setWorkspaces(workspaceResult.workspaces);
        }

        if (workspaceResult.workspaces.length === 0) {
          if (!canceled) {
            setFolders([]);
          }
          return;
        }

        if (canceled) {
          return;
        }

        const discoveredFolders = await scanNoteFoldersFromWorkspaces(
          workspaceResult.workspaces,
          excludedDirectoryNames,
          showScanFailureToast,
        );

        if (!canceled) {
          setFolders(discoveredFolders);
        }
      } catch (error) {
        console.error("Failed to scan Octarine folders", error);
        await showCaptureFailureToast("Failed to Scan Folders");
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void scanFolders();

    return () => {
      canceled = true;
    };
  }, [excludedDirectoryNames, hasConfiguredRoots]);

  const workspaceNames = useMemo(
    () =>
      Array.from(new Set(folders.map((folder) => folder.workspace.name))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [folders],
  );
  const filteredFolders = useMemo(
    () => folders.filter((folder) => selectedWorkspace === "all" || folder.workspace.name === selectedWorkspace),
    [folders, selectedWorkspace],
  );
  const searchFilteredFolders = useMemo(
    () => filteredFolders.filter((folder) => matchesSearchIndex(folder.searchText, searchText)),
    [filteredFolders, searchText],
  );
  const foldersByWorkspace = useMemo(() => groupFoldersByWorkspace(searchFilteredFolders), [searchFilteredFolders]);
  const renderState = getFolderPickerRenderState({
    hasWorkspaces: workspaces.length > 0,
    isLoading,
    searchFilteredFolderCount: searchFilteredFolders.length,
    selectedWorkspace,
  });

  async function handleFolderSelection(folder: IndexedNoteFolder) {
    if (!environment.canAccess(BrowserExtension)) {
      await showCaptureFailureToast(
        "Browser Extension Required",
        "Install and enable the Raycast Browser Extension to capture websites.",
      );
      return;
    }

    const loadingToast = await showToast({
      style: Toast.Style.Animated,
      title: "Capturing Website…",
    });

    try {
      const [content, tabs] = await Promise.all([
        BrowserExtension.getContent({ format: "markdown" }),
        BrowserExtension.getTabs(),
      ]);
      const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

      if (!content.trim()) {
        loadingToast.style = Toast.Style.Failure;
        loadingToast.title = "Nothing to Capture";
        loadingToast.message = "The active tab did not return any readable content.";
        return;
      }

      const notePath = buildNotePath(folder.path, buildWebsiteCaptureFileName(activeTab?.title, activeTab?.url));
      const didOpen = await upsertOctarineNoteContent({
        path: notePath,
        workspaceName: folder.workspace.name,
        content,
      });

      if (!didOpen) {
        await loadingToast.hide();
        return;
      }

      loadingToast.style = Toast.Style.Success;
      loadingToast.title = "Website Captured";
    } catch (error) {
      loadingToast.style = Toast.Style.Failure;
      loadingToast.title = "Failed to Capture Website";
      loadingToast.message = error instanceof Error ? error.message : "Try again with an active browser tab.";
    }
  }

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Select a destination folder..."
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
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noMatchingFolders: () => (
          <CollectionEmptyView
            title="No Matching Folders"
            description="Try a different workspace filter or search text."
          />
        ),
        showByWorkspace: () =>
          workspaceNames.map((workspaceName) => {
            const foldersInWorkspace = foldersByWorkspace.get(workspaceName) ?? [];
            if (foldersInWorkspace.length === 0) {
              return null;
            }

            return (
              <List.Section key={workspaceName} title={workspaceName}>
                {foldersInWorkspace.map((folder) => (
                  <List.Item
                    key={folder.id}
                    icon={Icon.Folder}
                    title={folder.name}
                    subtitle={folder.path || "/"}
                    keywords={[folder.path, folder.workspace.name]}
                    actions={
                      <ActionPanel>
                        <Action title="Capture Website" onAction={() => void handleFolderSelection(folder)} />
                      </ActionPanel>
                    }
                  />
                ))}
              </List.Section>
            );
          }),
        showFlat: () =>
          searchFilteredFolders.map((folder) => (
            <List.Item
              key={folder.id}
              icon={Icon.Folder}
              title={folder.name}
              subtitle={folder.path || "/"}
              keywords={[folder.path, folder.workspace.name]}
              actions={
                <ActionPanel>
                  <Action title="Capture Website" onAction={() => void handleFolderSelection(folder)} />
                </ActionPanel>
              }
            />
          )),
      })}
    </List>
  );
}

function QuickCaptureSection({
  excludedDirectoryNames,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
}) {
  return (
    <List.Section title="Quick Capture">
      <List.Item
        title="Website"
        icon={Icon.Globe}
        actions={
          <ActionPanel>
            <Action.Push
              title="Capture Website"
              target={
                <WebsiteCaptureFolderPicker
                  excludedDirectoryNames={excludedDirectoryNames}
                  hasConfiguredRoots={hasConfiguredRoots}
                />
              }
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Clipboard"
        icon={Icon.Clipboard}
        actions={
          <ActionPanel>
            <Action.Push
              title="Capture Clipboard"
              target={
                <ClipboardCapturePicker
                  excludedDirectoryNames={excludedDirectoryNames}
                  hasConfiguredRoots={hasConfiguredRoots}
                  workspaceSearchSignature={workspaceSearchSignature}
                />
              }
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Selected Text"
        icon={Icon.Text}
        actions={
          <ActionPanel>
            <Action.Push
              title="Capture Selected Text"
              target={
                <SelectedTextCapturePicker
                  excludedDirectoryNames={excludedDirectoryNames}
                  hasConfiguredRoots={hasConfiguredRoots}
                  workspaceSearchSignature={workspaceSearchSignature}
                />
              }
            />
          </ActionPanel>
        }
      />
    </List.Section>
  );
}

function ResultItem({ item }: { item: SearchableNoteItem }) {
  return isDailyDeskItem(item) ? (
    <DailyDeskListItem
      item={item}
      actionTitle={item.title}
      actionTarget={<AppendToDailyNoteForm workspaceName={item.workspaceName} date={item.date} title={item.title} />}
    />
  ) : (
    <NoteListItem note={item} actionTitle="Append to Note" actionTarget={<AppendToNoteForm note={item} />} />
  );
}

function WorkspaceSections({
  itemsByWorkspace,
  workspaceNames,
}: {
  itemsByWorkspace: Map<string, SearchableNoteItem[]>;
  workspaceNames: string[];
}) {
  return workspaceNames.map((workspaceName) => {
    const itemsInWorkspace = itemsByWorkspace.get(workspaceName) ?? [];

    if (itemsInWorkspace.length === 0) {
      return null;
    }

    return (
      <List.Section key={workspaceName} title={workspaceName}>
        {itemsInWorkspace.map((item) => (
          <ResultItem key={item.id} item={item} />
        ))}
      </List.Section>
    );
  });
}

function FlatItems({ filteredItems }: { filteredItems: SearchableNoteItem[] }) {
  return filteredItems.map((item) => <ResultItem key={item.id} item={item} />);
}

function QuickCaptureWithNotes({
  excludedDirectoryNames,
  filteredItems,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: {
  excludedDirectoryNames: Set<string>;
  filteredItems: SearchableNoteItem[];
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
}) {
  return (
    <>
      <QuickCaptureSection
        excludedDirectoryNames={excludedDirectoryNames}
        hasConfiguredRoots={hasConfiguredRoots}
        workspaceSearchSignature={workspaceSearchSignature}
      />
      <List.Section title="Notes">
        <FlatItems filteredItems={filteredItems} />
      </List.Section>
    </>
  );
}

function QuickCaptureWithWorkspaceSections({
  excludedDirectoryNames,
  hasConfiguredRoots,
  itemsByWorkspace,
  workspaceNames,
  workspaceSearchSignature,
}: {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
  itemsByWorkspace: Map<string, SearchableNoteItem[]>;
  workspaceNames: string[];
  workspaceSearchSignature: string;
}) {
  return (
    <>
      <QuickCaptureSection
        excludedDirectoryNames={excludedDirectoryNames}
        hasConfiguredRoots={hasConfiguredRoots}
        workspaceSearchSignature={workspaceSearchSignature}
      />
      <WorkspaceSections itemsByWorkspace={itemsByWorkspace} workspaceNames={workspaceNames} />
    </>
  );
}
