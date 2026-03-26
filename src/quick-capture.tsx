import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { AppendContentForm } from "./components/QuickCapture/AppendContentForm";
import { CaptureClipboard } from "./components/QuickCapture/CaptureClipboard";
import { CaptureSelectedText } from "./components/QuickCapture/CaptureSelectedText";
import { CaptureWebsite } from "./components/QuickCapture/CaptureWebsite";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { useQuickCapture, type DailyDeskItem, type QuickCaptureItem } from "./hooks/useQuickCapture";
import { type IndexedNote } from "./lib/notes";
import { openNote } from "./lib/octarine";
import { getExtensionPreferences } from "./lib/preferences";
import { match } from "./utils/match";

function isDailyDeskItem(item: QuickCaptureItem): item is DailyDeskItem {
  return "kind" in item && item.kind === "daily-desk";
}

function DailyDeskListItem({ item }: { item: DailyDeskItem }) {
  return (
    <List.Item
      icon={Icon.Calendar}
      title={item.title}
      keywords={[item.title, item.workspace]}
      actions={
        <ActionPanel>
          <Action.Push
            title={item.title}
            target={<AppendContentForm workspace={item.workspace} date={item.date} title={item.title} />}
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

function ResultItem({ item }: { item: QuickCaptureItem }) {
  return isDailyDeskItem(item) ? <DailyDeskListItem item={item} /> : <NoteListItem note={item} />;
}

function WorkspaceSections({
  itemsByWorkspace,
  workspaceNames,
}: {
  itemsByWorkspace: Map<string, QuickCaptureItem[]>;
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

function FlatItems({ filteredItems }: { filteredItems: QuickCaptureItem[] }) {
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
  filteredItems: QuickCaptureItem[];
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
  itemsByWorkspace: Map<string, QuickCaptureItem[]>;
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
  const { workspaceNames, filteredItems, itemsByWorkspace, renderState, isLoading } = useQuickCapture({
    searchText,
    selectedWorkspace,
    excludedDirectoryNames,
    workspaceSearchSignature: preferences.workspaceSearchSignature,
    hasConfiguredRoots: preferences.hasConfiguredRoots,
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
