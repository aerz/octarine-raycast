import { Action, ActionPanel, Icon, List, openExtensionPreferences, Toast, showToast } from "@raycast/api";
import type { ReactNode } from "react";
import { dailyNoteStem } from "@lib/daily-desk";
import { openNote } from "@lib/octarine";
import type { Workspace } from "@type/octarine";
import type { IndexedNote } from "@type/notes";

export type DailySuggestion = {
  label: string;
  date: string;
  target?: Workspace;
  locked: boolean;
};

type DailyNoteItemProps = {
  note: IndexedNote;
  showFilename: boolean;
  onRefresh: () => void;
  onWorkspaceOpened: (workspaceName: string) => void | Promise<void>;
  onOpenDate?: () => void;
  openDateTitle?: string;
};

type DailyNoteSuggestionProps = {
  suggestion: DailySuggestion;
  onOpen: (date: string, workspaceName: string) => Promise<void>;
  onChooseWorkspace: (date: string) => void;
  onOpenDate?: () => void;
  onClear: () => void | Promise<void>;
};

type DailyNoteActionsProps = {
  children?: ReactNode;
  onRefresh: () => void;
  onOpenDate?: () => void;
  openDateTitle?: string;
};

export function DailyNoteItem({
  note,
  showFilename,
  onRefresh,
  onWorkspaceOpened,
  onOpenDate,
  openDateTitle,
}: DailyNoteItemProps) {
  const openExistingNote = async () => {
    try {
      await openNote(note.path, note.folder.workspace.name, () => onWorkspaceOpened(note.folder.workspace.name));
    } catch (error) {
      console.error("Failed to open note", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Open Note",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <List.Item
      title={showFilename ? dailyNoteStem(note.path) : note.title}
      subtitle={showFilename ? note.title : undefined}
      keywords={[note.path, note.title, note.folder.workspace.name]}
      actions={
        <DailyNoteActions onRefresh={onRefresh} onOpenDate={onOpenDate} openDateTitle={openDateTitle}>
          <Action title="Open Note in Octarine" onAction={() => void openExistingNote()} />
        </DailyNoteActions>
      }
    />
  );
}

export function DailyNoteSuggestion({
  suggestion,
  onOpen,
  onChooseWorkspace,
  onOpenDate,
  onClear,
}: DailyNoteSuggestionProps) {
  const { label, date, target, locked } = suggestion;

  return (
    <List.Item
      icon={Icon.PlusCircle}
      title={label}
      actions={
        <ActionPanel>
          {target ? (
            <>
              <Action
                title={`Open in ${target.name}`}
                icon={Icon.AppWindow}
                onAction={() => void onOpen(date, target.name)}
              />
              {locked ? null : (
                <>
                  <Action title="Choose Workspace…" icon={Icon.List} onAction={() => onChooseWorkspace(date)} />
                  <Action title="Clear Last Workspace" icon={Icon.XMarkCircle} onAction={onClear} />
                </>
              )}
            </>
          ) : (
            <Action title={`Open ${label}`} icon={Icon.AppWindow} onAction={() => onChooseWorkspace(date)} />
          )}
          {onOpenDate ? (
            <Action
              title={`Force Open ${label}`}
              icon={Icon.PlusCircle}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
              onAction={onOpenDate}
            />
          ) : null}
        </ActionPanel>
      }
    />
  );
}

export function DailyNoteActions({ children, onRefresh, onOpenDate, openDateTitle }: DailyNoteActionsProps) {
  return (
    <ActionPanel>
      {children}
      {onOpenDate ? (
        <Action
          title={openDateTitle ?? "Force Open Typed Date"}
          icon={Icon.PlusCircle}
          shortcut={{ modifiers: ["cmd"], key: "return" }}
          onAction={onOpenDate}
        />
      ) : null}
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onRefresh} />
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
    </ActionPanel>
  );
}
