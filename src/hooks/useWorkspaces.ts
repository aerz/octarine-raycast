import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadWorkspaces, type LoadWorkspacesResult } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

export type LoadStatus = {
  isLoading: boolean;
  failed: boolean;
};

type Options = {
  refresh?: boolean;
  enabled?: boolean;
};

type Result = {
  workspaces: Workspace[];
  status: LoadStatus;
  revalidate: () => Promise<LoadWorkspacesResult>;
};

export function useWorkspaces(options: Options = {}): Result {
  const refresh = options.refresh ?? false;
  const enabled = options.enabled ?? true;

  const { data, error, isLoading, revalidate } = usePromise(
    async (refresh: boolean) => {
      const workspaces = await loadWorkspaces({ refresh });

      if (!workspaces.cached && workspaces.invalidRoots.length > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Workspaces were skipped",
          message: `${workspaces.invalidRoots.length} workspace roots could not be read`,
        });
      }

      return workspaces;
    },
    [refresh],
    {
      execute: enabled,
      onError: async () => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load workspaces",
        });
      },
    },
  );

  return {
    workspaces: data?.workspaces ?? [],
    status: {
      isLoading,
      failed: Boolean(error),
    },
    revalidate,
  };
}
