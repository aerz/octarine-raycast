import { Action, ActionPanel, LaunchProps, Clipboard, Icon, openExtensionPreferences } from "@raycast/api";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openTodayNote } from "./lib/octarine";
import { getOpenTodayNotePreferences } from "./lib/preferences";

type Arguments = {
  workspace?: string;
};

export default function OpenTodayNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const preferences = getOpenTodayNotePreferences();
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const defaultWorkspace = preferences.workspace;
  const targetWorkspace = requestedWorkspace ? requestedWorkspace : defaultWorkspace;

  const { workspaces, status, revalidate } = useWorkspaces();
  useOpenTarget({
    requestedWorkspace: targetWorkspace,
    workspaces,
    status,
    open: openTodayNote,
  });

  return (
    <WorkspaceMenu
      isLoading={status.isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search Octarine workspaces..."
      renderActions={(workspace) => (
        <ActionPanel>
          <Action title="Open Today's Note" onAction={() => openTodayNote(workspace.name)} />
          <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => Clipboard.copy(workspace.path)} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      )}
    />
  );
}
