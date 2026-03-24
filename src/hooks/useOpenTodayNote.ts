import { useEffect, useMemo, useRef, useState } from "react";
import { openOctarineTodayNote } from "../lib/octarine";
import type { Workspace } from "../types/octarine";
import { useWorkspaceNotFound } from "./useWorkspaceNotFound";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  workspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
};

type Result = {
  shouldHideMenu: boolean;
};

export function useOpenTodayNote({ workspace, workspaces, status }: Options): Result {
  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasAttemptedDirectOpen = useRef(false);

  const matchedWorkspace = useMemo(() => {
    if (!workspace) {
      return undefined;
    }

    return workspaces.find((candidate) => candidate.name === workspace);
  }, [workspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace: workspace,
    status,
    hasMatchedWorkspace: matchedWorkspace !== undefined,
  });

  useEffect(() => {
    if (!workspace || !matchedWorkspace || hasAttemptedDirectOpen.current) {
      return;
    }

    hasAttemptedDirectOpen.current = true;
    void (async () => {
      const isTodayNoteOpened = await openOctarineTodayNote(matchedWorkspace.name);

      if (!isTodayNoteOpened) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [workspace, matchedWorkspace]);

  useEffect(() => {
    hasAttemptedDirectOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [workspace]);

  const shouldHideMenu = Boolean(workspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound);

  return {
    shouldHideMenu,
  };
}
