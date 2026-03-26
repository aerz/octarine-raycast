import { Clipboard } from "@raycast/api";
import { type IndexedNote } from "../../lib/notes";
import {
  appendContentToDailyTarget,
  appendContentToNote,
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

    await appendContentToNote(note, clipboardText, "Capturing Clipboard…", "Clipboard Captured");
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

            await appendContentToDailyTarget(
              workspaceName,
              date,
              clipboardText,
              `Capturing Clipboard to ${date}…`,
              `Clipboard Captured to ${date}`,
            );
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
