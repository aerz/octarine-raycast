import { Action, ActionPanel, Icon } from "@raycast/api";
import { openOctarineAttachment } from "../lib/octarine";
import { type IndexedAttachment } from "../types/attachment";

type Props = {
  file: IndexedAttachment;
};

export function AttachmentActions({ file }: Props) {
  return (
    <ActionPanel>
      <Action
        title="Search Attachment"
        icon={Icon.Globe}
        onAction={() => openOctarineAttachment(file.name, file.workspace.name)}
      />
      <Action.Open title="Open File" target={file.path} shortcut={{ modifiers: ["cmd"], key: "return" }} />
      <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
      <Action.CopyToClipboard title="Copy File Path" content={file.path} shortcut={{ modifiers: ["cmd"], key: "." }} />
    </ActionPanel>
  );
}
