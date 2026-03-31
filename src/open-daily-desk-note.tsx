import { Action, LaunchProps, Icon } from "@raycast/api";
import { DateFormatsDetail } from "./components/notifications/date-formats";
import { WorkspaceList } from "./components/workspace-list";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { isSupportedDate } from "./lib/daily-desk";
import { openDailyDeskNote } from "./lib/octarine";

type Arguments = {
  date: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const isValidDate = isSupportedDate(requestedDate);
  const {
    workspaces,
    status: workspaceStatus,
    revalidate,
  } = useWorkspaces({
    enabled: isValidDate,
  });

  useOpenTarget({
    requestedWorkspace,
    workspaces,
    status: workspaceStatus,
    open: (workspaceName) => openDailyDeskNote(requestedDate, workspaceName),
  });

  if (!isValidDate) {
    return <DateFormatsDetail />;
  }

  return (
    <WorkspaceList isLoading={workspaceStatus.isLoading} workspaces={workspaces} onRefresh={revalidate}>
      {(workspace) => (
        <Action
          title="Open Daily Desk Note"
          icon={Icon.AppWindow}
          onAction={() => openDailyDeskNote(requestedDate, workspace.name)}
        />
      )}
    </WorkspaceList>
  );
}
