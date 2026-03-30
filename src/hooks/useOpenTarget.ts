import { Toast, showToast } from "@raycast/api";
import { useEffect } from "react";
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

  useEffect(() => {
    if (!workspaceNotFound) {
      return;
    }

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

  return {
    shouldClose: Boolean(workspace && !workspaceNotFound),
  };
}

function findWorkspaceByName(workspace: string, workspaces: Workspace[]): Workspace | undefined {
  if (!workspace) {
    return undefined;
  }
  return workspaces.find((item) => item.name === workspace);
}
