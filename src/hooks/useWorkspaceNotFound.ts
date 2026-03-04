import { Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef } from "react";

type UseWorkspaceNotFoundOptions = {
  requestedWorkspace: string;
  hasRequestedWorkspace: boolean;
  isLoading: boolean;
  hasWorkspaceLoadFailed: boolean;
  matchedWorkspace?: unknown;
  enabled?: boolean;
  toastTitle?: (workspaceName: string) => string;
};

export function useWorkspaceNotFound({
  requestedWorkspace,
  hasRequestedWorkspace,
  isLoading,
  hasWorkspaceLoadFailed,
  matchedWorkspace,
  enabled = true,
  toastTitle,
}: UseWorkspaceNotFoundOptions): boolean {
  const lastWorkspaceNotFoundToast = useRef<string | undefined>(undefined);

  const isWorkspaceNotFound = useMemo(
    () => Boolean(enabled && hasRequestedWorkspace && !isLoading && !hasWorkspaceLoadFailed && !matchedWorkspace),
    [enabled, hasRequestedWorkspace, isLoading, hasWorkspaceLoadFailed, matchedWorkspace],
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
