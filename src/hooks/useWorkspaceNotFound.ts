import { Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef } from "react";

import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  status: LoadStatus;
  matched: boolean;
  enabled?: boolean;
};

export function useWorkspaceNotFound({ requestedWorkspace, status, matched, enabled = true }: Options): boolean {
  const notFound = useMemo(
    () => enabled && Boolean(requestedWorkspace) && !status.isLoading && !status.failed && !matched,
    [enabled, requestedWorkspace, status, matched],
  );
  const lastNotFound = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!notFound || lastNotFound.current === requestedWorkspace) {
      return;
    }

    lastNotFound.current = requestedWorkspace;
    void showToast({
      style: Toast.Style.Failure,
      title: `Workspace “${requestedWorkspace}” not found`,
    });
  }, [notFound, requestedWorkspace]);

  return notFound;
}
