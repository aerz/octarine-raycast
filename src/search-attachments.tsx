import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { AttachmentsEmptyView } from "@components/empty-views/attachments";
import { SearchAttachmentsEmptyView } from "@components/empty-views/search";
import { type WorkspaceAttachmentsSection, useAttachments } from "@hooks/useAttachments";
import { useWorkspaces } from "@hooks/useWorkspaces";
import { openAttachment } from "@lib/octarine";
import { searchAttachmentsPreferences } from "@lib/preferences";
import type { IndexedAttachment } from "@type/attachments";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

type ExtensionDropdownProps = {
  extensions: string[];
  value: string;
  onChange: (value: string) => void;
};

type AttachmentsGridProps = {
  sections: WorkspaceAttachmentsSection[];
  grouped?: boolean;
  showWorkspaceAttachmentCount?: boolean;
  onRefresh: () => void;
};

type AttachmentActionsProps = {
  onRefresh: () => void;
  children?: ReactNode;
};

export default function SearchAttachmentsCommand() {
  const preferences = searchAttachmentsPreferences();
  const [selectedExtension, setSelectedExtension] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [refresh, setRefresh] = useState(false);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
    revalidate: revalidateWorkspaces,
  } = useWorkspaces({ refresh });
  const { dropdown, sections, isLoading, revalidate } = useAttachments({
    workspaces,
    enabled: !isWorkspacesLoading,
    excludedExtensions: preferences.excludedExtensions,
    searchText,
    selectedExtension,
    refresh,
  });
  const hasResults = sections.some((section) => section.attachments.length > 0);
  const onRefresh = () => {
    if (refresh) {
      void revalidateWorkspaces();
      revalidate();
    } else {
      setRefresh(true);
    }
  };

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments"
      searchBarAccessory={
        <ExtensionDropdown extensions={dropdown} value={selectedExtension} onChange={setSelectedExtension} />
      }
    >
      {dropdown.length === 0 ? (
        <AttachmentsEmptyView actions={<AttachmentActions onRefresh={onRefresh} />} />
      ) : !hasResults ? (
        <SearchAttachmentsEmptyView actions={<AttachmentActions onRefresh={onRefresh} />} />
      ) : selectedExtension === "all" ? (
        <AttachmentsGrid
          grouped
          sections={sections}
          showWorkspaceAttachmentCount={preferences.showWorkspaceAttachmentCount}
          onRefresh={onRefresh}
        />
      ) : (
        <AttachmentsGrid sections={sections} onRefresh={onRefresh} />
      )}
    </Grid>
  );
}

function ExtensionDropdown({ extensions, value, onChange }: ExtensionDropdownProps) {
  return (
    <Grid.Dropdown tooltip="Filter by file extension" value={value} onChange={onChange}>
      <Grid.Dropdown.Item title="All Extensions" value="all" />
      {extensions.map((extension) => (
        <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
      ))}
    </Grid.Dropdown>
  );
}

function AttachmentActions({ onRefresh, children }: AttachmentActionsProps) {
  return (
    <ActionPanel>
      {children}
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}

function AttachmentsGrid({
  sections,
  grouped = false,
  showWorkspaceAttachmentCount = false,
  onRefresh,
}: AttachmentsGridProps) {
  if (grouped) {
    return sections.map((section) => (
      <Grid.Section
        key={section.workspace.path}
        title={
          showWorkspaceAttachmentCount
            ? `${section.workspace.name} (${section.attachments.length})`
            : section.workspace.name
        }
      >
        {section.attachments.map((file) => (
          <AttachmentGridItem key={file.path} file={file} onRefresh={onRefresh} />
        ))}
      </Grid.Section>
    ));
  }

  return sections.flatMap((section) =>
    section.attachments.map((file) => <AttachmentGridItem key={file.path} file={file} onRefresh={onRefresh} />),
  );
}

function AttachmentGridItem({ file, onRefresh }: { file: IndexedAttachment; onRefresh: () => void }) {
  return (
    <Grid.Item
      title={file.name}
      subtitle={file.extension.toUpperCase()}
      content={attachmentPreview(file)}
      quickLook={{ name: file.name, path: file.path }}
      keywords={[file.workspace.name, file.extension]}
      actions={
        <AttachmentActions onRefresh={onRefresh}>
          <Action.Open title="Open File" target={file.path} />
          <ActionPanel.Section title="Octarine">
            <Action
              title="Search in Octarine"
              icon={Icon.MagnifyingGlass}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
              onAction={() => void openAttachment(file.name, file.workspace.name)}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="File">
            <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
            <Action.ShowInFinder title="Reveal in Finder" path={file.path} />
            <Action.CopyToClipboard
              title="Copy File Path"
              content={file.path}
              shortcut={{ modifiers: ["cmd"], key: "." }}
            />
          </ActionPanel.Section>
        </AttachmentActions>
      }
    />
  );
}

function attachmentPreview(file: IndexedAttachment): Grid.Item.Props["content"] {
  if (IMAGE_EXTENSIONS.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}
