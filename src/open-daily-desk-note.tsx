import { Action, ActionPanel, LaunchProps, Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateFormatsDetail } from "./components/Notifications/DateFormatsDetail";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useWorkspaceNotFound } from "./hooks/useWorkspaceNotFound";
import type { WorkspaceLoadStatus } from "./hooks/useWorkspaces";
import { isSupportedDailyDeskDate } from "./lib/daily-desk";
import { buildDailyNoteUri, openOctarineUri } from "./lib/octarine";
import { loadWorkspaces } from "./lib/workspaces";
import type { Workspace } from "./types/octarine";

type OpenDailyDeskNoteArguments = {
  date: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: OpenDailyDeskNoteArguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const hasRequestedWorkspace = requestedWorkspace.length > 0;
  const isDateValid = useMemo(() => isSupportedDailyDeskDate(requestedDate), [requestedDate]);

  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasShownDateErrorToast = useRef(false);
  const hasAttemptedAutoOpen = useRef(false);

  const openDailyDeskNote = useCallback(
    async (workspaceName: string) => {
      const octarineUri = buildDailyNoteUri(requestedDate, workspaceName);
      return openOctarineUri(octarineUri);
    },
    [requestedDate],
  );

  const {
    data: workspaceResult,
    error: workspaceLoadError,
    isLoading,
  } = usePromise(
    async () => {
      const result = await loadWorkspaces();

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
    [],
    {
      execute: isDateValid,
      onError: async () => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Load Workspaces",
        });
      },
    },
  );
  const workspaces = workspaceResult?.workspaces ?? [];
  const workspaceStatus: WorkspaceLoadStatus = {
    isLoading,
    hasFailed: Boolean(workspaceLoadError),
  };

  const matchedWorkspace = useMemo(() => {
    if (!hasRequestedWorkspace) {
      return undefined;
    }

    return workspaces.find((workspace) => workspace.name === requestedWorkspace);
  }, [hasRequestedWorkspace, requestedWorkspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace,
    status: workspaceStatus,
    hasMatchedWorkspace: matchedWorkspace !== undefined,
    enabled: isDateValid,
  });

  useEffect(() => {
    if (isDateValid || hasShownDateErrorToast.current) {
      return;
    }

    hasShownDateErrorToast.current = true;
    void showToast({
      style: Toast.Style.Failure,
      title: "Invalid date",
      message: "Use a supported Octarine date format",
    });
  }, [isDateValid]);

  useEffect(() => {
    if (!isDateValid || !matchedWorkspace || hasAttemptedAutoOpen.current) {
      return;
    }

    hasAttemptedAutoOpen.current = true;
    void (async () => {
      const didOpen = await openDailyDeskNote(matchedWorkspace.name);

      if (!didOpen) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [isDateValid, matchedWorkspace, openDailyDeskNote]);

  useEffect(() => {
    hasAttemptedAutoOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [requestedWorkspace, requestedDate]);

  if (!isDateValid) {
    return <DateFormatsDetail />;
  }

  if (hasRequestedWorkspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound) {
    return null;
  }

  const workspaceMenu = (
    <WorkspaceMenu
      isLoading={isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Select an Octarine workspace..."
      renderActions={(workspace: Workspace) => (
        <ActionPanel>
          <Action title="Open Daily Desk Note" onAction={() => void openDailyDeskNote(workspace.name)} />
        </ActionPanel>
      )}
    />
  );

  return workspaceMenu;
}
