import { Action, ActionPanel, Clipboard, Icon, LaunchProps, openExtensionPreferences } from "@raycast/api";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useOpenWorkspace } from "./hooks/useOpenWorkspace";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { openOctarineWorkspace } from "./lib/octarine";

type Arguments = {
  workspace?: string;
};

export default function OpenWorkspaceCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";

  const { workspaces, isLoading, revalidate, hasLoadFailed } = useWorkspaces({
    refresh: true,
  });

  const { shouldHideMenu } = useOpenWorkspace({
    requestedWorkspace,
    workspaces,
    isLoading,
    hasWorkspaceLoadFailed: hasLoadFailed,
  });

  if (shouldHideMenu) {
    return null;
  }

  return (
    <WorkspaceMenu
      isLoading={isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search Octarine workspaces..."
      emptyView={
        <WorkspaceNotFound>
          <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
        </WorkspaceNotFound>
      }
      renderActions={(workspace) => (
        <ActionPanel>
          <Action
            title="Open in Octarine"
            icon={Icon.AppWindow}
            onAction={() => void openOctarineWorkspace(workspace.name)}
          />
          <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => void Clipboard.copy(workspace.path)} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      )}
    />
  );
}
