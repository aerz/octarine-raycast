import { Toast, showToast } from "@raycast/api";
import { useEffect, useRef } from "react";
import type { Workspace } from "../types/octarine";
import { findWorkspaceByName } from "../lib/workspaces";
import type { LoadStatus } from "./useWorkspaces";

type Options = {
  requestedWorkspace: string;
  workspaces: Workspace[];
  status: LoadStatus;
  open: (workspaceName: string) => Promise<void>;
};

export function useOpenTarget({ requestedWorkspace, workspaces, status, open }: Options) {
  const workspace = findWorkspaceByName(workspaces, requestedWorkspace);
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
