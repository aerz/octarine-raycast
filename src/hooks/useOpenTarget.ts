import { Toast, showToast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../types/octarine";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
  open: (workspaceName: string) => Promise<boolean>;
};

type Result = {
  shouldClose: boolean;
};

export function useOpenTarget({ requestedWorkspace, workspaces, status, open }: Options): Result {
  const workspace = findWorkspaceByName(requestedWorkspace, workspaces);
  const workspaceNotFound = Boolean(requestedWorkspace) && !status.isLoading && !status.failed && !workspace;
  const opened = useRef(false);
  const lastToast = useRef<string | undefined>(undefined);
  const [openFailed, setOpenFailed] = useState(false);

  useEffect(() => {
    if (!workspaceNotFound || lastToast.current === requestedWorkspace) {
      return;
    }

    lastToast.current = requestedWorkspace;
    void showToast({
      style: Toast.Style.Failure,
      title: `Workspace “${requestedWorkspace}” not found`,
    });
  }, [workspaceNotFound, requestedWorkspace]);

  useEffect(() => {
    if (!requestedWorkspace || !workspace || opened.current) {
      return;
    }

    opened.current = true;
    void open(workspace.name).then((opened) => {
      if (!opened) {
        setOpenFailed(true);
      }
    });
  }, [workspace, open, requestedWorkspace]);

  return {
    shouldClose: Boolean(workspace && !workspaceNotFound && !openFailed),
  };
}

function findWorkspaceByName(workspace: string, workspaces: Workspace[]): Workspace | undefined {
  if (!workspace) {
    return undefined;
  }
  return workspaces.find((item) => item.name === workspace);
}
