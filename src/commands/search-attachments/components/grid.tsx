import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import type { ReactNode } from "react";
import { openAttachment } from "@lib/octarine";
import type { IndexedAttachment } from "@type/attachments";
import type { WorkspaceAttachmentsSection } from "../hooks/use-attachments";

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

export function ExtensionDropdown({ extensions, value, onChange }: ExtensionDropdownProps) {
  return (
    <Grid.Dropdown tooltip="Filter by file extension" value={value} onChange={onChange}>
      <Grid.Dropdown.Item title="All Extensions" value="all" />
      {extensions.map((extension) => (
        <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
      ))}
    </Grid.Dropdown>
  );
}

export function AttachmentActions({ onRefresh, children }: AttachmentActionsProps) {
  return (
    <ActionPanel>
      {children}
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}

export function AttachmentsGrid({
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
