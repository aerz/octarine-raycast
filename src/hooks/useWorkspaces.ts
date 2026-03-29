import { usePromise } from "@raycast/utils";
import { skippedWorkspacesToast, workspacesLoadToast } from "../components/Toasts";
import { loadWorkspaces, type LoadWorkspacesResult } from "../lib/workspaces";
import type { Workspace } from "../types/octarine";

type Options = {
  refresh?: boolean;
  enabled?: boolean;
};

export type LoadStatus = {
  isLoading: boolean;
  hasFailed: boolean;
};

type Result = {
  workspaces: Workspace[];
  status: LoadStatus;
  revalidate: () => Promise<LoadWorkspacesResult>;
  error: Error | undefined;
};

export function useWorkspaces(options: Options = {}): Result {
  const refresh = options.refresh ?? false;
  const enabled = options.enabled ?? true;

  const { data, error, isLoading, revalidate } = usePromise(
    async (refresh: boolean) => {
      const result = await loadWorkspaces({ forceRefresh: refresh });
      if (!result.fromCache && result.invalidRoots.length > 0) {
        await skippedWorkspacesToast(result.invalidRoots.length);
      }

      return result;
    },
    [refresh],
    {
      execute: enabled,
      onError: workspacesLoadToast,
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
