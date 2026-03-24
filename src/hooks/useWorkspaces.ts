import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadWorkspaces, type WorkspaceLoadResult } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

type Options = {
  refresh?: boolean;
  enabled?: boolean;
};

export type WorkspaceLoadStatus = {
  isLoading: boolean;
  hasFailed: boolean;
};

type Result = {
  workspaces: Workspace[];
  status: WorkspaceLoadStatus;
  revalidate: () => Promise<WorkspaceLoadResult>;
  error: Error | undefined;
};

export function useWorkspaces(options: Options = {}): Result {
  const refresh = options.refresh ?? false;
  const enabled = options.enabled ?? true;

  const { data, error, isLoading, revalidate } = usePromise(
    async (refresh: boolean) => {
      const result = await loadWorkspaces({ forceRefresh: refresh });

      if (!result.fromCache && result.invalidRoots.length > 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Workspaces were skipped",
          message: `${result.invalidRoots.length} workspace roots could not be read.`,
        });
      }

      return result;
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
      hasFailed: Boolean(error),
    },
    revalidate,
    error: error instanceof Error ? error : undefined,
  };
}
