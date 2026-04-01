import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { SearchNotesEmptyView } from "./components/empty-views/search-results";
import { WorkspaceNotesEmptyView } from "./components/empty-views/workspace-missing-files";
import { WorkspaceListEmptyView } from "./components/empty-views/workspace";
import { CaptureClipboard } from "./components/quick-capture/capture-clipboard";
import { CaptureContentForm } from "./components/quick-capture/capture-content-form";
import { CaptureSelectedText } from "./components/quick-capture/capture-selected-text";
import { CaptureWebsite } from "./components/quick-capture/capture-website";
import { useQuickCapture, type QuickCaptureItem } from "./hooks/useQuickCapture";
import { isDailyDeskItem, type DailyDeskItem } from "./lib/daily-desk";
import { type IndexedNote } from "./lib/notes";
import { openNote } from "./lib/octarine";
import { extensionPreferences } from "./lib/preferences";
import { match } from "./utils/match";

export default function QuickCaptureCommand() {
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const { workspaces, items, workspaceItems, searchState, isLoading } = useQuickCapture({
    search: searchText,
    workspace: selectedWorkspace,
  });

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search notes or type a date"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaces.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {match(searchState, {
        noConfiguredWorkspaces: () => <WorkspaceListEmptyView />,
        noAvailableNotes: () => <WorkspaceNotesEmptyView />,
        noMatchingNotes: () => <SearchNotesEmptyView />,
        showByWorkspaceWithQuickCapture: () => (
          <QuickCaptureWithWorkspaceSections itemsByWorkspace={workspaceItems} workspaceNames={workspaces} />
        ),
        showByWorkspace: () => <WorkspaceSections itemsByWorkspace={workspaceItems} workspaceNames={workspaces} />,
        showFlatWithQuickCapture: () => <QuickCaptureWithNotes filteredItems={items} />,
        showFlat: () => <FlatItems filteredItems={items} />,
      })}
    </List>
  );
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
            title="Append to Daily Desk Note"
            target={<CaptureContentForm workspace={item.workspace} date={item.date} title={item.title} />}
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
          <Action.Push title="Append to Note" target={<CaptureContentForm note={note} />} />
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

function QuickCaptureWithNotes({ filteredItems }: { filteredItems: QuickCaptureItem[] }) {
  const preferences = extensionPreferences();

  return (
    <>
      <QuickCaptureSection
        excludedDirectoryNames={preferences.excludedFoldersInWorkspaces}
        hasConfiguredRoots={preferences.hasConfiguredRoots}
        workspaceSearchSignature={preferences.workspaceSearchSignature}
      />
      <List.Section title="Notes">
        <FlatItems filteredItems={filteredItems} />
      </List.Section>
    </>
  );
}

function QuickCaptureWithWorkspaceSections({
  itemsByWorkspace,
  workspaceNames,
}: {
  itemsByWorkspace: Map<string, QuickCaptureItem[]>;
  workspaceNames: string[];
}) {
  const preferences = extensionPreferences();

  return (
    <>
      <QuickCaptureSection
        excludedDirectoryNames={preferences.excludedFoldersInWorkspaces}
        hasConfiguredRoots={preferences.hasConfiguredRoots}
        workspaceSearchSignature={preferences.workspaceSearchSignature}
      />
      <WorkspaceSections itemsByWorkspace={itemsByWorkspace} workspaceNames={workspaceNames} />
    </>
  );
}
