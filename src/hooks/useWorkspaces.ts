import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadWorkspaces, type ScanWorkspacesResult } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

const EMPTY_WORKSPACES: Workspace[] = [];

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
  revalidate: () => Promise<ScanWorkspacesResult>;
};

export function useWorkspaces(options: Options = {}): Result {
  const refresh = options.refresh ?? false;
  const enabled = options.enabled ?? true;

  const { data, error, isLoading, revalidate } = usePromise(
    async (refresh: boolean) => {
      const { workspaces, invalidRoots } = await loadWorkspaces({ refresh });

      if (invalidRoots.length > 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "Invalid workspace root paths",
          message: `${invalidRoots.length} paths could not be found`,
        });
      } else if (workspaces.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: "No workspaces found",
          message: "Check root paths in preferences",
        });
      }

      return {
        workspaces,
        invalidRoots,
      };
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
    workspaces: data?.workspaces ?? EMPTY_WORKSPACES,
    status: {
      isLoading,
      failed: Boolean(error),
    },
    revalidate,
  };
}
