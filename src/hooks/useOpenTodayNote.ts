import { useEffect, useMemo, useRef, useState } from "react";
import { openOctarineTodayNote } from "../lib/octarine";
import type { Workspace } from "../types/octarine";
import { useWorkspaceNotFound } from "./useWorkspaceNotFound";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
};

type Result = {
  shouldHideMenu: boolean;
};

export function useOpenTodayNote({ requestedWorkspace, workspaces, status }: Options): Result {
  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasAttemptedDirectOpen = useRef(false);
  const matchedWorkspace = useMemo(() => {
    if (!requestedWorkspace) return undefined;
    return workspaces.find((candidate) => candidate.name === requestedWorkspace);
  }, [requestedWorkspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace,
    status,
    matched: matchedWorkspace !== undefined,
  });

  useEffect(() => {
    if (!requestedWorkspace || !matchedWorkspace || hasAttemptedDirectOpen.current) {
      return;
    }

    hasAttemptedDirectOpen.current = true;
    void (async () => {
      const isTodayNoteOpened = await openOctarineTodayNote(matchedWorkspace.name);

      if (!isTodayNoteOpened) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [requestedWorkspace, matchedWorkspace]);

  useEffect(() => {
    hasAttemptedDirectOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [requestedWorkspace]);

  const shouldHideMenu = Boolean(
    requestedWorkspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound,
  );

  return {
    shouldHideMenu,
  };
}
