import { useMemo } from "react";
import { Action, ActionPanel, LaunchProps } from "@raycast/api";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useOpenTodayNote } from "./hooks/useOpenTodayNote";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openOctarineTodayNote } from "./lib/octarine";
import { getOpenTodayNotePreferences } from "./lib/preferences";

type Arguments = {
  workspace?: string;
};

export default function OpenTodayNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const preferences = useMemo(() => getOpenTodayNotePreferences(), []);
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const defaultWorkspace = preferences.workspace;
  const targetWorkspace = requestedWorkspace ? requestedWorkspace : defaultWorkspace;

  const { workspaces, status } = useWorkspaces();
  const { shouldHideMenu } = useOpenTodayNote({
    workspace: targetWorkspace,
    workspaces,
    status,
  });

  if (shouldHideMenu) {
    return null;
  }

  return (
    <WorkspaceMenu
      isLoading={status.isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search Octarine workspaces..."
      renderActions={(workspace) => (
        <ActionPanel>
          <Action title="Open Today's Note" onAction={() => openOctarineTodayNote(workspace.name)} />
        </ActionPanel>
      )}
    />
  );
}
