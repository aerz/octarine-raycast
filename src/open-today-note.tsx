import { Action, LaunchProps } from "@raycast/api";
import { WorkspaceList } from "./components/workspace-list";
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
    <WorkspaceList isLoading={status.isLoading} workspaces={workspaces} onRescan={revalidate}>
      {(workspace) => <Action title="Open Today's Note" onAction={() => openTodayNote(workspace.name)} />}
    </WorkspaceList>
  );
}
