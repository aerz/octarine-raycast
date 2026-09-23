import { Action, ActionPanel, Icon, List } from "@raycast/api";
import type { ReactNode } from "react";
import { openNote } from "@lib/octarine";
import type { IndexedNote } from "@type/notes";
import type { NoteMatch } from "../lib/note-search";
import type { Result as NotePreviewResult } from "../hooks/use-note-preview";
import type { SearchNotesActions, SearchNotesMode } from "../hooks/use-search";
import { NotePreview, NoteSidebarPreview } from "./note-preview";

type NoteResult = {
  note: IndexedNote;
  match?: NoteMatch;
};

type NoteItemProps = {
  result: NoteResult;
  mode: SearchNotesMode;
  actions: SearchNotesActions;
  preview: NotePreviewResult;
};

type ActionPanelProps = {
  mode: SearchNotesMode;
  actions: SearchNotesActions;
  onRefresh: () => void;
  children?: ReactNode;
};

export function NoteItem({ result, mode, actions, preview }: NoteItemProps) {
  const { note, match } = result;
  const selected = note.id === preview.selectedNoteId;
  const accessories: List.Item.Accessory[] = [];
  if (match?.kind === "content") accessories.push({ icon: Icon.Paragraph, tooltip: `Content match · ${note.path}` });
  if (note.pinned) accessories.push({ icon: Icon.Tack, tooltip: "Pinned" });

  return (
    <List.Item
      id={note.id}
      title={note.title}
      subtitle={match?.kind === "content" ? { value: match.excerpt, tooltip: note.path } : note.path}
      keywords={[note.path, note.folder.workspace.name]}
      accessories={accessories}
      detail={preview.isVisible && selected ? <NoteSidebarPreview key={preview.refreshKey} note={note} /> : undefined}
      actions={
        <SearchNotesActionPanel mode={mode} actions={actions} onRefresh={preview.refresh}>
          <Action title="Open Note in Octarine" onAction={() => void openNote(note.path, note.folder.workspace.name)} />
          <Action
            title={preview.isVisible ? "Hide Preview" : "Show Preview"}
            icon={Icon.Eye}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onAction={preview.toggle}
          />
          <Action.Push title="Quick Look Note" icon={Icon.Eye} target={<NotePreview note={note} />} />
        </SearchNotesActionPanel>
      }
    />
  );
}

export function SearchNotesActionPanel({ mode, actions, onRefresh, children }: ActionPanelProps) {
  const pinnedOnly = mode.pinnedOnly;

  return (
    <ActionPanel>
      {children}
      <Action
        title={pinnedOnly ? "Show All Notes" : "Show Pinned Notes Only"}
        icon={pinnedOnly ? Icon.Document : Icon.Tack}
        onAction={actions.togglePinned}
      />
      <Action
        title={mode.contentEnabled ? "Search Titles and Paths Only" : "Search Note Contents"}
        icon={mode.contentEnabled ? Icon.MagnifyingGlass : Icon.Paragraph}
        shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
        onAction={actions.toggleContent}
      />
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
    </ActionPanel>
  );
}
