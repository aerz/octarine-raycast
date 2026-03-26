import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { AppendContentForm } from "./components/QuickCapture/AppendContentForm";
import { CaptureClipboard } from "./components/QuickCapture/CaptureClipboard";
import { CaptureSelectedText } from "./components/QuickCapture/CaptureSelectedText";
import { CaptureWebsite } from "./components/QuickCapture/CaptureWebsite";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { useNotes } from "./hooks/useNotes";
import { type IndexedNote } from "./lib/notes";
import { openNote } from "./lib/octarine";
import { getExtensionPreferences } from "./lib/preferences";
import { match } from "./utils/match";

type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  title: string;
  workspaceName: string;
};

type SearchableNoteItem = IndexedNote | DailyDeskItem;

type QuickCaptureRenderState =
  | "noConfiguredWorkspaces"
  | "noAvailableNotes"
  | "noMatchingNotes"
  | "showByWorkspace"
  | "showFlat"
  | "showByWorkspaceWithQuickCapture"
  | "showFlatWithQuickCapture";

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

function isDailyDeskItem(item: SearchableNoteItem): item is DailyDeskItem {
  return "kind" in item && item.kind === "daily-desk";
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
    return scopedMatch.matchedWorkspaceNames.map((workspaceName) => ({
      date: scopedMatch.date,
      id: `daily-desk::${workspaceName}::${scopedMatch.date}`,
      kind: "daily-desk",
      title: `Use "${scopedMatch.date}" in Daily Desk`,
      workspaceName,
    }));
  }

  return workspaceNames.map((workspaceName) => ({
    date: trimmedSearchText,
    id: `daily-desk::${workspaceName}::${trimmedSearchText}`,
    kind: "daily-desk",
    title: `Use "${trimmedSearchText}" in Daily Desk`,
    workspaceName,
  }));
}

function DailyDeskListItem({ item }: { item: DailyDeskItem }) {
  return (
    <List.Item
      icon={Icon.Calendar}
      title={item.title}
      keywords={[item.title, item.workspaceName]}
      actions={
        <ActionPanel>
          <Action.Push
            title={item.title}
            target={<AppendContentForm workspaceName={item.workspaceName} date={item.date} title={item.title} />}
          />
        </ActionPanel>
      }
    />
  );
}

function NoteListItem({ note }: { note: IndexedNote }) {
  return (
    <List.Item
      title={note.title}
      subtitle={note.path}
      keywords={[note.path, note.workspace.name]}
      actions={
        <ActionPanel>
          <Action.Push title="Append to Note" target={<AppendContentForm note={note} />} />
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

function ResultItem({ item }: { item: SearchableNoteItem }) {
  return isDailyDeskItem(item) ? <DailyDeskListItem item={item} /> : <NoteListItem note={item} />;
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
                <CaptureWebsite
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
                <CaptureClipboard
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
                <CaptureSelectedText
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
