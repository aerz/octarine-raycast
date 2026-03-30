import { Action, ActionPanel, Clipboard, Icon, LaunchProps, openExtensionPreferences } from "@raycast/api";
import { useState } from "react";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useOpenTarget } from "./hooks/useOpenTarget";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openWorkspace } from "./lib/octarine";

type Arguments = {
  workspace?: string;
};

export default function OpenWorkspaceCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const [refresh, setRefresh] = useState(false);

  const { workspaces, status, revalidate } = useWorkspaces({ refresh });
  const { shouldClose } = useOpenTarget({
    requestedWorkspace,
    workspaces,
    status,
    open: openWorkspace,
  });

  if (shouldClose) {
    return null;
  }

  return (
    <WorkspaceMenu
      isLoading={status.isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search workspaces..."
      emptyView={
        <WorkspaceNotFound>
          <Action
            title="Rescan Workspaces"
            icon={Icon.ArrowClockwise}
            onAction={() => (refresh ? revalidate() : setRefresh(true))}
          />
        </WorkspaceNotFound>
      }
      renderActions={(workspace) => (
        <ActionPanel>
          <Action title="Open Workspace" icon={Icon.AppWindow} onAction={() => openWorkspace(workspace.name)} />
          <Action
            title="Rescan Workspaces"
            icon={Icon.ArrowClockwise}
            onAction={() => (refresh ? revalidate() : setRefresh(true))}
          />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => Clipboard.copy(workspace.path)} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      )}
    />
  );
}
