import { Clipboard } from "@raycast/api";
import { appendDailyNoteContent, appendNoteContent } from "../../lib/octarine";
import { type IndexedNote } from "../../lib/notes";
import {
  AutoCaptureToDailyDeskTarget,
  NotePicker,
  showCaptureFailureToast,
  type QuickCaptureNotePickerProps,
} from "./shared";

export function CaptureClipboard({
  excludedDirectoryNames,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: QuickCaptureNotePickerProps) {
  async function handleSelectNote(note: IndexedNote) {
    const clipboardText = await Clipboard.readText();

    if (!clipboardText?.trim()) {
      await showCaptureFailureToast("Clipboard Is Empty", "Copy some text and try again.");
      return;
    }

    try {
      await appendNoteContent({
        path: note.path,
        workspace: note.workspace.name,
        content: clipboardText,
      });
    } catch (error) {
      await showCaptureFailureToast("Failed to Capture Clipboard", error instanceof Error ? error.message : "Try again.");
    }
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

            try {
              await appendDailyNoteContent({
                workspace: workspaceName,
                date,
                content: clipboardText,
              });
            } catch (error) {
              await showCaptureFailureToast(
                "Failed to Capture Clipboard",
                error instanceof Error ? error.message : "Try again.",
              );
            }
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
