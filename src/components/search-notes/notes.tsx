import { Action, ActionPanel, Icon, List } from "@raycast/api";
import type { ReactNode } from "react";
import type { SearchNotesActions, SearchNotesMode } from "@hooks/useSearchNotes";
import type { NoteMatch } from "@lib/note-search";
import { openNote } from "@lib/octarine";
import type { IndexedNote } from "@type/notes";

type NoteResult = {
  note: IndexedNote;
  match?: NoteMatch;
};

type NoteItemProps = {
  result: NoteResult;
  mode: SearchNotesMode;
  actions: SearchNotesActions;
};

type ActionPanelProps = {
  mode: SearchNotesMode;
  actions: SearchNotesActions;
  children?: ReactNode;
};

export function NoteItem({ result, mode, actions }: NoteItemProps) {
  const { note, match } = result;
  const accessories: List.Item.Accessory[] = [];
  if (match?.kind === "content") accessories.push({ icon: Icon.Paragraph, tooltip: `Content match · ${note.path}` });
  if (note.pinned) accessories.push({ icon: Icon.Tack, tooltip: "Pinned" });

  return (
    <List.Item
      title={note.title}
      subtitle={match?.kind === "content" ? { value: match.excerpt, tooltip: note.path } : note.path}
      keywords={[note.path, note.folder.workspace.name]}
      accessories={accessories}
      actions={
        <SearchNotesActionPanel mode={mode} actions={actions}>
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.folder.workspace.name)} />
        </SearchNotesActionPanel>
      }
    />
  );
}

export function SearchNotesActionPanel({ mode, actions, children }: ActionPanelProps) {
  const pinnedOnly = mode.scope === "pinned";

  return (
    <ActionPanel>
      {children}
      <Action
        title={pinnedOnly ? "Show All Notes" : "Show Pinned Notes Only"}
        icon={pinnedOnly ? Icon.Document : Icon.Tack}
        onAction={actions.toggleScope}
      />
      <Action
        title={mode.contentEnabled ? "Search Titles and Paths Only" : "Search Note Contents"}
        icon={mode.contentEnabled ? Icon.MagnifyingGlass : Icon.Paragraph}
        shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
        onAction={actions.toggleContent}
      />
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={actions.refresh} />
    </ActionPanel>
  );
}
