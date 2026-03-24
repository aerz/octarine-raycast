import { useEffect, useMemo, useRef, useState } from "react";
import { openOctarineDailyDeskNote } from "../lib/octarine";
import type { Workspace } from "../types/octarine";
import { useWorkspaceNotFound } from "./useWorkspaceNotFound";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  date: string;
  requestedWorkspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
  enabled?: boolean;
};

type Result = {
  shouldHideMenu: boolean;
};

export function useOpenDailyDeskNote({
  date,
  requestedWorkspace,
  workspaces,
  status,
  enabled = true,
}: Options): Result {
  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasAttemptedDirectOpen = useRef(false);

  const matchedWorkspace = useMemo(() => {
    if (!requestedWorkspace) {
      return undefined;
    }

    return workspaces.find((workspace) => workspace.name === requestedWorkspace);
  }, [requestedWorkspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace,
    status,
    hasMatchedWorkspace: matchedWorkspace !== undefined,
    enabled,
  });

  useEffect(() => {
    if (!enabled || !requestedWorkspace || !matchedWorkspace || hasAttemptedDirectOpen.current) {
      return;
    }

    hasAttemptedDirectOpen.current = true;
    void (async () => {
      const didOpen = await openOctarineDailyDeskNote(date, matchedWorkspace.name);

      if (!didOpen) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [date, enabled, requestedWorkspace, matchedWorkspace]);

  useEffect(() => {
    hasAttemptedDirectOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [date, requestedWorkspace]);

  const shouldHideMenu = Boolean(
    enabled && requestedWorkspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound,
  );

  return {
    shouldHideMenu,
  };
}
