import { getSelectedText } from "@raycast/api";
import { type IndexedNote } from "../../lib/notes";
import {
  appendContentToDailyTarget,
  appendContentToNote,
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

    await appendContentToNote(note, selectedText, "Capturing Selected Text…", "Selected Text Captured");
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

            await appendContentToDailyTarget(
              workspaceName,
              date,
              selectedText,
              `Capturing Selected Text to ${date}…`,
              `Selected Text Captured to ${date}`,
            );
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
