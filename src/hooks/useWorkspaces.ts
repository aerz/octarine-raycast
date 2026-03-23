import { Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadWorkspaces, type WorkspaceLoadResult } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

type UseWorkspacesOptions = {
  refresh?: boolean;
};

type UseWorkspacesResult = {
  workspaces: Workspace[];
  isLoading: boolean;
  revalidate: () => Promise<WorkspaceLoadResult>;
  error: Error | undefined;
  hasLoadFailed: boolean;
};

export function useWorkspaces(options: UseWorkspacesOptions = {}): UseWorkspacesResult {
  const refresh = options.refresh ?? false;

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
    isLoading,
    revalidate,
    error: error instanceof Error ? error : undefined,
    hasLoadFailed: Boolean(error),
  };
}
