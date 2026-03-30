import { Toast, showToast } from "@raycast/api";
import { useEffect, useRef } from "react";
import type { Workspace } from "../types/octarine";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
  open: (workspaceName: string) => Promise<boolean>;
};

export function useOpenTarget({ requestedWorkspace, workspaces, status, open }: Options) {
  const workspace = findWorkspaceByName(requestedWorkspace, workspaces);
  const workspaceNotFound = Boolean(requestedWorkspace) && !status.isLoading && !status.failed && !workspace;
  const lastToast = useRef("");

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
    if (!requestedWorkspace || !workspace) {
      return;
    }

    void open(workspace.name);
  }, [workspace, open, requestedWorkspace]);
}

function findWorkspaceByName(workspace: string, workspaces: Workspace[]): Workspace | undefined {
  if (!workspace) {
    return undefined;
  }
  return workspaces.find((item) => item.name === workspace);
}
