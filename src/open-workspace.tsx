import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  LaunchProps,
  Toast,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceNotFound } from "./components/empty-views/WorkspaceNotFound";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useWorkspaceNotFound } from "./hooks/useWorkspaceNotFound";
import { buildOpenWorkspaceUri, openOctarineUri } from "./lib/octarine";
import { loadWorkspaces } from "./lib/workspaces";

type OpenWorkspaceArguments = {
  workspace?: string;
};

export default function OpenWorkspaceCommand(props: LaunchProps<{ arguments: OpenWorkspaceArguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const hasRequestedWorkspace = requestedWorkspace.length > 0;

  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0);
  const hasAttemptedAutoOpen = useRef(false);

  const openWorkspace = useCallback(async (workspaceName: string) => {
    const octarineUri = buildOpenWorkspaceUri(workspaceName);
    return openOctarineUri(octarineUri);
  }, []);

  const {
    data: workspaceResult,
    error: workspaceLoadError,
    isLoading,
  } = usePromise(
    async (refreshToken: number) => {
      const result = await loadWorkspaces({ forceRefresh: refreshToken > 0 });

      if (!result.fromCache && result.invalidRoots.length > 0) {
        const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
        await showToast({
          style: Toast.Style.Failure,
          title: "Some workspace roots were skipped",
          message: `${result.invalidRoots.length} ${noun} could not be read.`,
        });
      }

      return result;
    },
    [workspaceRefreshToken],
    {
      onError: async () => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load workspaces",
        });
      },
    },
  );
  const workspaces = workspaceResult?.workspaces ?? [];
  const hasWorkspaceLoadFailed = Boolean(workspaceLoadError);

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
    hasMatchedWorkspace: matchedWorkspace !== undefined,
  });

  useEffect(() => {
    if (!hasRequestedWorkspace || !matchedWorkspace || hasAttemptedAutoOpen.current) {
      return;
    }

    hasAttemptedAutoOpen.current = true;
    void (async () => {
      const didOpen = await openWorkspace(matchedWorkspace.name);

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
        <WorkspaceNotFound>
          <Action
            title="Rescan Workspaces"
            icon={Icon.ArrowClockwise}
            onAction={() => setWorkspaceRefreshToken((currentValue) => currentValue + 1)}
          />
        </WorkspaceNotFound>
      }
      renderActions={(workspace) => (
        <ActionPanel>
          <Action title="Open in Octarine" icon={Icon.AppWindow} onAction={() => void openWorkspace(workspace.name)} />
          <Action
            title="Rescan Workspaces"
            icon={Icon.ArrowClockwise}
            onAction={() => setWorkspaceRefreshToken((currentValue) => currentValue + 1)}
          />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => void Clipboard.copy(workspace.path)} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      )}
    />
  );

  return workspaceMenu;
}
