import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useState, type ReactNode } from "react";
import { SearchAttachmentsEmptyView } from "./components/empty-views/search";
import { type WorkspaceAttachmentsSection, useAttachments } from "./hooks/useAttachments";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openAttachment } from "./lib/octarine";
import { searchAttachmentsPreferences } from "./lib/preferences";
import type { IndexedAttachment } from "./types/attachments";

type WorkspaceDropdownProps = {
  sections: string[];
  value: string;
  onChange: (value: string) => void;
};

type AttachmentsGridProps = {
  sections: WorkspaceAttachmentsSection[];
  grouped?: boolean;
  showWorkspaceAttachmentCount?: boolean;
};

export default function SearchAttachmentsCommand() {
  const preferences = searchAttachmentsPreferences();
  const [selectedExtension, setSelectedExtension] = useState("all");
  const [searchText, setSearchText] = useState("");
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
  } = useWorkspaces();
  const { dropdown, sections, isLoading } = useAttachments({
    workspaces,
    enabled: !isWorkspacesLoading,
    excludedExtensions: preferences.excludedExtensions,
    searchText,
    selectedExtension,
  });
  const hasResults = sections.some((section) => section.attachments.length > 0);

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments"
      searchBarAccessory={
        <WorkspaceDropdown sections={dropdown} value={selectedExtension} onChange={setSelectedExtension} />
      }
    >
      {dropdown.length === 0 ? (
        <AttachmentsEmptyView actions={<DefaultActionPanel />} />
      ) : !hasResults ? (
        <SearchAttachmentsEmptyView />
      ) : selectedExtension === "all" ? (
        <AttachmentsGrid
          grouped
          sections={sections}
          showWorkspaceAttachmentCount={preferences.showWorkspaceAttachmentCount}
        />
      ) : (
        <AttachmentsGrid sections={sections} />
      )}
    </Grid>
  );
}

function DefaultActionPanel({ children }: { children?: ReactNode }) {
  return <ActionPanel>{children}</ActionPanel>;
}

function WorkspaceDropdown({ sections, value, onChange }: WorkspaceDropdownProps) {
  return (
    <Grid.Dropdown tooltip="Filter by file extension" value={value} onChange={onChange}>
      <Grid.Dropdown.Item title="All Extensions" value="all" />
      {sections.map((section) => (
        <Grid.Dropdown.Item key={section} title={section.toUpperCase()} value={section} />
      ))}
    </Grid.Dropdown>
  );
}

function AttachmentsEmptyView({ actions }: { actions?: ReactNode }) {
  return (
    <Grid.EmptyView
      icon={Icon.Paperclip}
      title="No Attachments Found"
      description="Attach a file to any note in Octarine to see it here."
      actions={actions}
    />
  );
}

function AttachmentsGrid({ sections, grouped = false, showWorkspaceAttachmentCount = false }: AttachmentsGridProps) {
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
          <AttachmentGridItem key={file.path} file={file} />
        ))}
      </Grid.Section>
    ));
  }

  return sections.flatMap((section) =>
    section.attachments.map((file) => <AttachmentGridItem key={file.path} file={file} />),
  );
}

function AttachmentGridItem({ file }: { file: IndexedAttachment }) {
  return (
    <Grid.Item
      title={file.name}
      subtitle={file.extension.toUpperCase()}
      content={attachmentPreview(file)}
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

function attachmentPreview(file: IndexedAttachment): Grid.Item.Props["content"] {
  const extensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

  if (extensions.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}
