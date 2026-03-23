import { Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef } from "react";

import type { WorkspaceLoadStatus } from "./useWorkspaces";

type UseWorkspaceNotFoundOptions = {
  requestedWorkspace: string;
  status: WorkspaceLoadStatus;
  hasMatchedWorkspace: boolean;
  enabled?: boolean;
  toastTitle?: (workspaceName: string) => string;
};

export function useWorkspaceNotFound({
  requestedWorkspace,
  status,
  hasMatchedWorkspace,
  enabled = true,
  toastTitle,
}: UseWorkspaceNotFoundOptions): boolean {
  const lastWorkspaceNotFoundToast = useRef<string | undefined>(undefined);

  const isWorkspaceNotFound = useMemo(
    () => enabled && Boolean(requestedWorkspace) && !status.isLoading && !status.hasFailed && !hasMatchedWorkspace,
    [enabled, requestedWorkspace, status, hasMatchedWorkspace],
  );

  useEffect(() => {
    if (!isWorkspaceNotFound || lastWorkspaceNotFoundToast.current === requestedWorkspace) {
      return;
    }

    lastWorkspaceNotFoundToast.current = requestedWorkspace;
    void showToast({
      style: Toast.Style.Failure,
      title: toastTitle?.(requestedWorkspace) ?? `Workspace ${requestedWorkspace} not found`,
    });
  }, [isWorkspaceNotFound, requestedWorkspace, toastTitle]);

  return isWorkspaceNotFound;
}
