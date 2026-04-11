import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useMemo, useState } from "react";
import { SearchAttachmentsEmptyView } from "./components/empty-views/search-results";
import { WorkspaceAttachmentsEmptyView } from "./components/empty-views/workspace-missing-files";
import { type AttachmentSection, useAttachments } from "./hooks/useAttachments";
import { openAttachment } from "./lib/octarine";
import { searchAttachmentsPreferences } from "./lib/preferences";
import type { IndexedAttachment } from "./types/attachments";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

export default function SearchAttachmentsCommand() {
  const preferences = searchAttachmentsPreferences();
  const excludedExtensions = useMemo(
    () => Array.from(preferences.excludedExtensions).sort((a, b) => a.localeCompare(b)),
    [preferences.excludedExtensionsSignature],
  );
  const [selectedExtension, setSelectedExtension] = useState("all");
  const [searchText, setSearchText] = useState("");
  const { dropdown, sections, isLoading } = useAttachments({
    excludedExtensions,
    excludedExtensionsSignature: preferences.excludedExtensionsSignature,
    searchText,
    selectedExtension,
  });
  const hasResults = sections.length > 0;

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={selectedExtension === "all"}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments"
      searchBarAccessory={
        <Grid.Dropdown tooltip="Filter by file extension" value={selectedExtension} onChange={setSelectedExtension}>
          <Grid.Dropdown.Item title="All Extensions" value="all" />
          {dropdown.map((extension) => (
            <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
          ))}
        </Grid.Dropdown>
      }
    >
      {dropdown.length === 0 ? (
        <WorkspaceAttachmentsEmptyView />
      ) : !hasResults ? (
        <NoMatchingResultsView
          onClear={() => {
            setSelectedExtension("all");
            setSearchText("");
          }}
        />
      ) : selectedExtension === "all" ? (
        <WorkspaceSectionGrid
          sections={sections}
          showWorkspaceAttachmentCount={preferences.showWorkspaceAttachmentCount}
        />
      ) : (
        sections.flatMap((section) => section.files.map((file) => <AttachmentGridItem key={file.path} file={file} />))
      )}
    </Grid>
  );
}

function NoMatchingResultsView({ onClear }: { onClear: () => void }) {
  return (
    <SearchAttachmentsEmptyView>
      <Action title="Clear Extension Filter" onAction={onClear} />
    </SearchAttachmentsEmptyView>
  );
}

function WorkspaceSectionGrid({
  sections,
  showWorkspaceAttachmentCount,
}: {
  sections: AttachmentSection[];
  showWorkspaceAttachmentCount: boolean;
}) {
  return sections.map((section) => (
    <Grid.Section
      key={section.workspacePath}
      title={
        showWorkspaceAttachmentCount ? `${section.workspaceName} (${section.files.length})` : section.workspaceName
      }
    >
      {section.files.map((file) => (
        <AttachmentGridItem key={file.path} file={file} />
      ))}
    </Grid.Section>
  ));
}

function AttachmentGridItem({ file }: { file: IndexedAttachment }) {
  return (
    <Grid.Item
      title={file.name}
      subtitle={file.extension.toUpperCase()}
      content={attachmentContent(file)}
      quickLook={{ name: file.name, path: file.path }}
      keywords={[file.workspace.name, file.extension]}
      actions={
        <ActionPanel>
          <Action
            title="Search Attachments"
            icon={Icon.Globe}
            onAction={() => openAttachment(file.name, file.workspace.name)}
          />
          <Action.Open title="Open File" target={file.path} shortcut={{ modifiers: ["cmd"], key: "return" }} />
          <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
          <Action.CopyToClipboard
            title="Copy File Path"
            content={file.path}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
        </ActionPanel>
      }
    />
  );
}

function attachmentContent(file: IndexedAttachment): Grid.Item.Props["content"] {
  if (IMAGE_EXTENSIONS.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}
