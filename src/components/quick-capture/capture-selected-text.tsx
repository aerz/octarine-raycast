import { getSelectedText } from "@raycast/api";
import { appendDailyNoteContent, appendNoteContent } from "../../lib/octarine";
import { type IndexedNote } from "../../types/notes";
import {
  AutoCaptureToDailyDeskTarget,
  NotePicker,
  showCaptureFailureToast,
  type QuickCaptureNotePickerProps,
} from "./shared";

export function CaptureSelectedText({
  excludedDirectoryNames,
  hasConfiguredRoots,
  workspaceSearchSignature,
}: QuickCaptureNotePickerProps) {
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

    try {
      await appendNoteContent({
        path: note.path,
        workspace: note.folder.workspace.name,
        content: selectedText,
      });
    } catch (error) {
      await showCaptureFailureToast(
        "Failed to Capture Selected Text",
        error instanceof Error ? error.message : "Try again.",
      );
    }
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

            try {
              await appendDailyNoteContent({
                workspace: workspaceName,
                date,
                content: selectedText,
              });
            } catch (error) {
              await showCaptureFailureToast(
                "Failed to Capture Selected Text",
                error instanceof Error ? error.message : "Try again.",
              );
            }
          }}
        />
      )}
      excludedDirectoryNames={excludedDirectoryNames}
      hasConfiguredRoots={hasConfiguredRoots}
      onSelectNote={handleSelectNote}
      searchBarPlaceholder="Search notes or type a date for selected text..."
      workspaceSearchSignature={workspaceSearchSignature}
    />
  );
}
