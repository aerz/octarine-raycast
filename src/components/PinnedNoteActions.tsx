import { Action, ActionPanel } from "@raycast/api";
import { openPinnedNote } from "../lib/octarine";
import { type IndexedNote } from "../lib/notes";

type Props = {
  note: IndexedNote;
};

export function PinnedNoteActions({ note }: Props) {
  return (
    <ActionPanel>
      <Action title="Open Pinned Note" onAction={() => void openPinnedNote(note.path, note.workspace.name)} />
    </ActionPanel>
  );
}
