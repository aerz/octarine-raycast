import { Action, Icon, LaunchProps } from "@raycast/api";
import { useState } from "react";
import { WorkspaceList } from "./components/workspace-list";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openWorkspace } from "./lib/octarine";

type Arguments = {
  workspace?: string;
};

export default function OpenWorkspaceCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const [refresh, setRefresh] = useState(false);

  const onRescan = () => (refresh ? revalidate() : setRefresh(true));
  const { workspaces, status, revalidate } = useWorkspaces({ refresh });
  useOpenTarget({
    requestedWorkspace,
    workspaces,
    status,
    open: openWorkspace,
  });

  return (
    <WorkspaceList isLoading={status.isLoading} workspaces={workspaces} onRescan={onRescan}>
      {(workspace) => (
        <Action title="Open Workspace" icon={Icon.AppWindow} onAction={() => openWorkspace(workspace.name)} />
      )}
    </WorkspaceList>
  );
}
