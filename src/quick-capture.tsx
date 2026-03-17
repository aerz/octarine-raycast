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
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import path from "node:path";
import { DateFormatsDetail } from "./components/Notifications/DateFormatsDetail";
import { CollectionEmptyView } from "./components/EmptyViews/CollectionEmptyView";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { isSupportedDailyDeskDate } from "./lib/daily-desk";
import {
  IndexedNote,
  IndexedNoteFolder,
  loadCachedNotes,
  matchesSearchQuery,
  saveCachedNotes,
  scanNoteFoldersFromWorkspaces,
  scanNotesFromWorkspaces,
} from "./lib/notes";
import { appendDailyNoteContent, buildOpenNoteUri, openOctarineUri, upsertOctarineNoteContent } from "./lib/octarine";
import { getExtensionPreferences } from "./lib/preferences";
import { buildSearchIndexText, matchesSearchIndex } from "./lib/search";
import { loadWorkspaces } from "./lib/workspaces";
import type { Workspace } from "./types/octarine";

type AppendFormValues = {
  content: string;
};

type FolderPickerProps = {
  workspaces: Workspace[];
  excludedDirectoryNames: Set<string>;
};

type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  searchIndex: string;
  title: string;
  workspace: Workspace;
};

type SearchableNoteItem = IndexedNote | DailyDeskItem;

type NotePickerProps = {
  actionTitle: string;
  buildDailyDeskTarget: (workspaceName: string, date: string, title: string) => React.ReactElement;
  hasWorkspaces: boolean;
  isLoading: boolean;
  notes: IndexedNote[];
  workspaces: Workspace[];
  onSelectNote: (note: IndexedNote) => Promise<void>;
  searchBarPlaceholder: string;
};

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
    const workspaceName = item.workspace.name;
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

function renderNoteItem({
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
  const openUri = buildOpenNoteUri(note.path, note.workspace.name);

  return (
    <List.Item
      key={note.id}
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
          <Action title="Open Note in Octarine" icon={Icon.AppWindow} onAction={() => void openOctarineUri(openUri)} />
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
  workspaces: Workspace[],
  searchText: string,
): { date: string; matchedWorkspaces: Workspace[] } | undefined {
  const trimmedSearchText = searchText.trim();
  const queryTokens = trimmedSearchText.split(/\s+/).filter(Boolean);

  for (let tokenCount = queryTokens.length - 1; tokenCount >= 1; tokenCount -= 1) {
    const workspacePrefix = queryTokens.slice(0, tokenCount).join(" ");
    const normalizedWorkspacePrefix = normalizeWorkspacePhrase(workspacePrefix);
    const date = trimmedSearchText.slice(workspacePrefix.length).trim();

    if (!date) {
      continue;
    }

    const matchedWorkspaces = workspaces.filter((workspace) => {
      const normalizedWorkspaceName = normalizeWorkspacePhrase(workspace.name);
      return (
        normalizedWorkspaceName === normalizedWorkspacePrefix ||
        normalizedWorkspaceName.startsWith(`${normalizedWorkspacePrefix} `)
      );
    });

    if (matchedWorkspaces.length > 0) {
      return { date, matchedWorkspaces };
    }
  }

  return undefined;
}

function buildDailyDeskItems(workspaces: Workspace[], searchText: string): DailyDeskItem[] {
  const trimmedSearchText = searchText.trim();
  if (!trimmedSearchText) {
    return [];
  }

  const scopedMatch = findScopedWorkspaceMatch(workspaces, trimmedSearchText);
  if (scopedMatch) {
    return scopedMatch.matchedWorkspaces.map((workspace) => {
      const title = `Use "${scopedMatch.date}" in Daily Desk`;

      return {
        date: scopedMatch.date,
        id: `daily-desk::${workspace.path}::${scopedMatch.date}`,
        kind: "daily-desk" as const,
        searchIndex: buildSearchIndexText(title, "Daily Desk", workspace.name),
        title,
        workspace,
      };
    });
  }

  return workspaces.map((workspace) => {
    const title = `Use "${trimmedSearchText}" in Daily Desk`;

    return {
      date: trimmedSearchText,
      id: `daily-desk::${workspace.path}::${trimmedSearchText}`,
      kind: "daily-desk" as const,
      searchIndex: buildSearchIndexText(title, "Daily Desk", workspace.name),
      title,
      workspace,
    };
  });
}

function matchesSearchableItem(item: SearchableNoteItem, searchText: string): boolean {
  if (isDailyDeskItem(item)) {
    return matchesSearchIndex(item.searchIndex, searchText);
  }

  return matchesSearchQuery(item, searchText);
}

function renderDailyDeskItem({
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
      key={item.id}
      icon={Icon.Calendar}
      title={item.title}
      keywords={[item.title, item.workspace.name]}
      actions={
        <ActionPanel>
          {actionTarget ? (
            <Action.Push title={actionTitle} target={actionTarget} />
          ) : (
            <Action title={actionTitle} onAction={() => onAction?.(item.workspace.name)} />
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
  async function handleSubmit(values: AppendFormValues) {
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
          <Action.SubmitForm
            title="Append to Note"
            onSubmit={(values) => void handleSubmit(values as AppendFormValues)}
          />
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

  async function handleSubmit(values: AppendFormValues) {
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
            onSubmit={(values) => void handleSubmit(values as AppendFormValues)}
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

function NotePicker({
  actionTitle,
  buildDailyDeskTarget,
  hasWorkspaces,
  isLoading,
  notes,
  workspaces,
  onSelectNote,
  searchBarPlaceholder,
}: NotePickerProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");

  const workspaceNames = useMemo(
    () =>
      Array.from(new Set(workspaces.map((workspace) => workspace.name))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [workspaces],
  );

  const searchableItems = useMemo(
    () => [...notes, ...buildDailyDeskItems(workspaces, searchText)],
    [notes, searchText, workspaces],
  );
  const filteredItems = useMemo(
    () => searchableItems.filter((item) => selectedWorkspace === "all" || item.workspace.name === selectedWorkspace),
    [searchableItems, selectedWorkspace],
  );
  const searchFilteredItems = useMemo(
    () => filteredItems.filter((item) => matchesSearchableItem(item, searchText)),
    [filteredItems, searchText],
  );
  const itemsByWorkspace = useMemo(() => groupItemsByWorkspace(searchFilteredItems), [searchFilteredItems]);
  const showWorkspaceNotFound = !isLoading && !hasWorkspaces;
  const showNoNotesFound = !isLoading && hasWorkspaces && notes.length === 0 && searchText.trim().length === 0;
  const showNoMatchingNotes =
    !isLoading && !showWorkspaceNotFound && searchText.trim().length > 0 && searchFilteredItems.length === 0;

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
      {showWorkspaceNotFound ? <WorkspaceNotFound /> : null}
      {showNoNotesFound ? <WorkspaceContentEmptyView resource="notes" /> : null}
      {showNoMatchingNotes ? <SearchResultsEmptyView resource="notes" /> : null}
      {!showWorkspaceNotFound && !showNoNotesFound && !showNoMatchingNotes
        ? selectedWorkspace === "all"
          ? workspaceNames.map((workspaceName) => {
              const itemsInWorkspace = itemsByWorkspace.get(workspaceName) ?? [];

              if (itemsInWorkspace.length === 0) {
                return null;
              }

              return (
                <List.Section key={workspaceName} title={workspaceName}>
                  {itemsInWorkspace.map((item) =>
                    isDailyDeskItem(item)
                      ? renderDailyDeskItem({
                          item,
                          actionTitle: item.title,
                          actionTarget: buildDailyDeskTarget(item.workspace.name, item.date, item.title),
                        })
                      : renderNoteItem({
                          note: item,
                          actionTitle,
                          onAction: (selectedNote) => {
                            void onSelectNote(selectedNote);
                          },
                        }),
                  )}
                </List.Section>
              );
            })
          : searchFilteredItems.map((item) =>
              isDailyDeskItem(item)
                ? renderDailyDeskItem({
                    item,
                    actionTitle: item.title,
                    actionTarget: buildDailyDeskTarget(item.workspace.name, item.date, item.title),
                  })
                : renderNoteItem({
                    note: item,
                    actionTitle,
                    onAction: (selectedNote) => {
                      void onSelectNote(selectedNote);
                    },
                  }),
            )
        : null}
    </List>
  );
}

function ClipboardCapturePicker({
  hasWorkspaces,
  isLoading,
  notes,
  workspaces,
}: {
  hasWorkspaces: boolean;
  isLoading: boolean;
  notes: IndexedNote[];
  workspaces: Workspace[];
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
      hasWorkspaces={hasWorkspaces}
      isLoading={isLoading}
      notes={notes}
      workspaces={workspaces}
      onSelectNote={handleSelectNote}
      searchBarPlaceholder="Search notes or type a date for clipboard..."
    />
  );
}

function SelectedTextCapturePicker({
  hasWorkspaces,
  isLoading,
  notes,
  workspaces,
}: {
  hasWorkspaces: boolean;
  isLoading: boolean;
  notes: IndexedNote[];
  workspaces: Workspace[];
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
      hasWorkspaces={hasWorkspaces}
      isLoading={isLoading}
      notes={notes}
      workspaces={workspaces}
      onSelectNote={handleSelectNote}
      searchBarPlaceholder="Search notes or type a date for selected text..."
    />
  );
}

function WebsiteCaptureFolderPicker({ excludedDirectoryNames, workspaces }: FolderPickerProps) {
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
        if (workspaces.length === 0) {
          if (!canceled) {
            setFolders([]);
          }
          return;
        }

        const discoveredFolders = await scanNoteFoldersFromWorkspaces(
          workspaces,
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
  }, [excludedDirectoryNames, workspaces]);

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
  const showWorkspaceNotFound = !isLoading && workspaces.length === 0;
  const showNoMatchingFolders = !isLoading && !showWorkspaceNotFound && searchFilteredFolders.length === 0;

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
      {showWorkspaceNotFound ? <WorkspaceNotFound /> : null}
      {showNoMatchingFolders ? (
        <CollectionEmptyView
          title="No Matching Folders"
          description="Try a different workspace filter or search text."
        />
      ) : null}
      {!showWorkspaceNotFound && !showNoMatchingFolders
        ? selectedWorkspace === "all"
          ? workspaceNames.map((workspaceName) => {
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
            })
          : searchFilteredFolders.map((folder) => (
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
            ))
        : null}
    </List>
  );
}

export default function QuickCaptureCommand() {
  const extensionPreferences = useMemo(() => getExtensionPreferences(), []);
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
            setWorkspaces([]);
            setNotes([]);
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
        await showCaptureFailureToast("Failed to Scan Notes");
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
  const searchableItems = useMemo(
    () => [...notes, ...buildDailyDeskItems(workspaces, searchText)],
    [notes, searchText, workspaces],
  );
  const filteredItems = useMemo(
    () => searchableItems.filter((item) => selectedWorkspace === "all" || item.workspace.name === selectedWorkspace),
    [searchableItems, selectedWorkspace],
  );
  const searchFilteredItems = useMemo(
    () => filteredItems.filter((item) => matchesSearchableItem(item, searchText)),
    [filteredItems, searchText],
  );
  const itemsByWorkspace = useMemo(() => groupItemsByWorkspace(searchFilteredItems), [searchFilteredItems]);
  const showStaticActions = searchText.trim().length === 0;
  const showWorkspaceNotFound = !isLoading && (!hasConfiguredRoots || workspaces.length === 0);
  const showNoNotesFound = !isLoading && !showWorkspaceNotFound && notes.length === 0 && showStaticActions;
  const showNoMatchingNotes =
    !isLoading && !showWorkspaceNotFound && !showStaticActions && searchFilteredItems.length === 0;

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
      {showWorkspaceNotFound ? <WorkspaceNotFound /> : null}
      {showNoNotesFound ? <WorkspaceContentEmptyView resource="notes" /> : null}
      {showNoMatchingNotes ? <SearchResultsEmptyView resource="notes" /> : null}

      {!showWorkspaceNotFound && showStaticActions ? (
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
                      workspaces={workspaces}
                      excludedDirectoryNames={extensionPreferences.excludedFoldersInWorkspaces}
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
                      hasWorkspaces={workspaces.length > 0}
                      isLoading={isLoading}
                      notes={notes}
                      workspaces={workspaces}
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
                      hasWorkspaces={workspaces.length > 0}
                      isLoading={isLoading}
                      notes={notes}
                      workspaces={workspaces}
                    />
                  }
                />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}

      {!showWorkspaceNotFound && !showNoNotesFound && !showNoMatchingNotes
        ? selectedWorkspace === "all"
          ? workspaceNames.map((workspaceName) => {
              const itemsInWorkspace = itemsByWorkspace.get(workspaceName) ?? [];

              if (itemsInWorkspace.length === 0) {
                return null;
              }

              return (
                <List.Section key={workspaceName} title={workspaceName}>
                  {itemsInWorkspace.map((item) =>
                    isDailyDeskItem(item)
                      ? renderDailyDeskItem({
                          item,
                          actionTitle: item.title,
                          actionTarget: (
                            <AppendToDailyNoteForm
                              workspaceName={item.workspace.name}
                              date={item.date}
                              title={item.title}
                            />
                          ),
                        })
                      : renderNoteItem({
                          note: item,
                          actionTitle: "Append to Note",
                          actionTarget: <AppendToNoteForm note={item} />,
                        }),
                  )}
                </List.Section>
              );
            })
          : showStaticActions
            ? [
                <List.Section key="filtered-notes" title="Notes">
                  {searchFilteredItems.map((item) =>
                    isDailyDeskItem(item)
                      ? renderDailyDeskItem({
                          item,
                          actionTitle: item.title,
                          actionTarget: (
                            <AppendToDailyNoteForm
                              workspaceName={item.workspace.name}
                              date={item.date}
                              title={item.title}
                            />
                          ),
                        })
                      : renderNoteItem({
                          note: item,
                          actionTitle: "Append to Note",
                          actionTarget: <AppendToNoteForm note={item} />,
                        }),
                  )}
                </List.Section>,
              ]
            : searchFilteredItems.map((item) =>
                isDailyDeskItem(item)
                  ? renderDailyDeskItem({
                      item,
                      actionTitle: item.title,
                      actionTarget: (
                        <AppendToDailyNoteForm
                          workspaceName={item.workspace.name}
                          date={item.date}
                          title={item.title}
                        />
                      ),
                    })
                  : renderNoteItem({
                      note: item,
                      actionTitle: "Append to Note",
                      actionTarget: <AppendToNoteForm note={item} />,
                    }),
              )
        : null}
    </List>
  );
}
