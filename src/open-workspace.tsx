import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  List,
  Toast,
  open,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { Workspace, loadWorkspaces } from "./workspaces";

export default function OpenWorkspaceCommand() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setIsLoading(true);

    try {
      const result = await loadWorkspaces(options);
      setWorkspaces(result.workspaces);

      if (!result.fromCache && result.invalidRoots.length > 0) {
        const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
        await showToast({
          style: Toast.Style.Failure,
          title: "Some workspace roots were skipped",
          message: `${result.invalidRoots.length} ${noun} could not be read.`,
        });
      }
    } catch {
      setWorkspaces([]);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load workspaces",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const openWorkspace = useCallback(async (workspace: Workspace) => {
    const uri = `octarine://open?path=.&workspace=${encodeURIComponent(workspace.name)}`;

    try {
      await open(uri);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: `Failed to open ${workspace.name}`,
      });
    }
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Octarine workspaces...">
      {workspaces.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No Octarine workspaces found"
          description="Update Workspace Root Paths in command preferences, then run Rescan Workspaces."
          actions={
            <ActionPanel>
              <Action
                title="Rescan Workspaces"
                icon={Icon.ArrowClockwise}
                onAction={() => void refreshWorkspaces({ forceRefresh: true })}
              />
              <Action
                title="Open Command Preferences"
                icon={Icon.Gear}
                onAction={() => void openCommandPreferences()}
              />
            </ActionPanel>
          }
        />
      ) : (
        workspaces.map((workspace) => (
          <List.Item
            key={workspace.path}
            title={workspace.name}
            subtitle={workspace.path}
            actions={
              <ActionPanel>
                <Action title="Open in Octarine" icon={Icon.AppWindow} onAction={() => void openWorkspace(workspace)} />
                <Action
                  title="Rescan Workspaces"
                  icon={Icon.ArrowClockwise}
                  onAction={() => void refreshWorkspaces({ forceRefresh: true })}
                />
                <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => void Clipboard.copy(workspace.path)} />
                <Action
                  title="Open Command Preferences"
                  icon={Icon.Gear}
                  onAction={() => void openCommandPreferences()}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
