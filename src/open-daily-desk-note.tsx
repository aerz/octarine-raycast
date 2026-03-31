import { Action, LaunchProps, Toast, showToast, Icon } from "@raycast/api";
import { useEffect } from "react";
import { DateFormatsDetail } from "./components/notifications/date-formats-detail";
import { WorkspaceList } from "./components/workspace-list";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { isDailyDeskDate } from "./lib/daily-desk";
import { openDailyDeskNote } from "./lib/octarine";

type Arguments = {
  date: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const isValidDate = isDailyDeskDate(requestedDate);

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

  useEffect(() => {
    if (!isValidDate) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid date",
        message: "Use a supported Octarine date format",
      });
    }
  }, []);

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
