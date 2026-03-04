import {
  Action,
  ActionPanel,
  Clipboard,
  closeMainWindow,
  Icon,
  LaunchProps,
  List,
  popToRoot,
  Toast,
  open,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useWorkspaceNotFound } from "./hooks/useWorkspaceNotFound";
import { Workspace, loadWorkspaces } from "./lib/workspaces";

type OpenWorkspaceArguments = {
  workspace?: string;
};

export default function OpenWorkspaceCommand(props: LaunchProps<{ arguments: OpenWorkspaceArguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const hasRequestedWorkspace = requestedWorkspace.length > 0;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWorkspaceLoadFailed, setHasWorkspaceLoadFailed] = useState(false);
  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasAttemptedAutoOpen = useRef(false);

  const exitCommand = useCallback(async () => {
    await popToRoot({ clearSearchBar: true });
    await closeMainWindow();
  }, []);

  const openWorkspace = useCallback(
    async (workspaceName: string, options?: { exitAfterOpen?: boolean }) => {
      const uri = `octarine://daily?date=today&workspace=${encodeURIComponent(workspaceName)}`;

      try {
        await open(uri);

        if (options?.exitAfterOpen) {
          await exitCommand();
        }

        return true;
      } catch {
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to open ${workspaceName}`,
        });

        return false;
      }
    },
    [exitCommand],
  );

  const refreshWorkspaces = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setIsLoading(true);
    setHasWorkspaceLoadFailed(false);

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
      setHasWorkspaceLoadFailed(true);
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

  const matchedWorkspace = useMemo(() => {
    if (!hasRequestedWorkspace) {
      return undefined;
    }

    return workspaces.find((workspace) => workspace.name === requestedWorkspace);
  }, [hasRequestedWorkspace, requestedWorkspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace,
    hasRequestedWorkspace,
    isLoading,
    hasWorkspaceLoadFailed,
    matchedWorkspace,
  });

  useEffect(() => {
    if (!hasRequestedWorkspace || !matchedWorkspace || hasAttemptedAutoOpen.current) {
      return;
    }

    hasAttemptedAutoOpen.current = true;
    void (async () => {
      const didOpen = await openWorkspace(matchedWorkspace.name, { exitAfterOpen: true });

      if (!didOpen) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [hasRequestedWorkspace, matchedWorkspace, openWorkspace]);

  useEffect(() => {
    hasAttemptedAutoOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [requestedWorkspace]);

  if (hasRequestedWorkspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound) {
    return null;
  }

  const workspaceMenu = (
    <WorkspaceMenu
      isLoading={isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search Octarine workspaces..."
      emptyView={
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
      }
      renderActions={(workspace) => (
        <ActionPanel>
          <Action
            title="Open in Octarine"
            icon={Icon.AppWindow}
            onAction={() => void openWorkspace(workspace.name, { exitAfterOpen: true })}
          />
          <Action
            title="Rescan Workspaces"
            icon={Icon.ArrowClockwise}
            onAction={() => void refreshWorkspaces({ forceRefresh: true })}
          />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => void Clipboard.copy(workspace.path)} />
          <Action title="Open Command Preferences" icon={Icon.Gear} onAction={() => void openCommandPreferences()} />
        </ActionPanel>
      )}
    />
  );

  return workspaceMenu;
}
