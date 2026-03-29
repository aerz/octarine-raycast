import { Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef } from "react";

import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  status: LoadStatus;
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
}: Options): boolean {
  const lastWorkspaceNotFoundToast = useRef<string | undefined>(undefined);

  const isWorkspaceNotFound = useMemo(
    () => enabled && Boolean(requestedWorkspace) && !status.isLoading && !status.failed && !hasMatchedWorkspace,
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
