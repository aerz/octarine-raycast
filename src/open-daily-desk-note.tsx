import { Action, LaunchProps, Icon } from "@raycast/api";
import { useState } from "react";
import { DateFormatsDetail } from "./components/notifications/date-formats";
import { WorkspaceList } from "./components/workspace-list";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { resolveDateArg } from "./lib/daily-desk";
import { openDailyDeskNote } from "./lib/octarine";

type Arguments = {
  date: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const supportedDate = Boolean(resolveDateArg(requestedDate));
  const [refresh, setRefresh] = useState(false);
  const { workspaces, status, revalidate } = useWorkspaces({ enabled: supportedDate, refresh });
  const onRefresh = () => (refresh ? revalidate() : setRefresh(true));

  useOpenTarget({
    requestedWorkspace,
    workspaces,
    status,
    open: (workspaceName) => openDailyDeskNote(requestedDate, workspaceName),
  });

  if (!supportedDate) {
    return <DateFormatsDetail />;
  }

  return (
    <WorkspaceList isLoading={status.isLoading} workspaces={workspaces} onRefresh={onRefresh}>
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
