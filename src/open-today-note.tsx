import {
  Action,
  ActionPanel,
  List,
  Toast,
  closeMainWindow,
  getPreferenceValues,
  open,
  popToRoot,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { loadWorkspaces } from "./lib/workspaces";

type CommandPreferences = {
  workspaceName?: string;
};

function buildDailyUri(workspaceName: string): string {
  return `octarine://daily?date=today&workspace=${encodeURIComponent(workspaceName)}`;
}

export default function OpenTodayNoteCommand() {
  const preferences = getPreferenceValues<CommandPreferences>();
  const defaultWorkspaceName = preferences.workspaceName?.trim() ?? "";
  const hasDefaultWorkspace = defaultWorkspaceName.length > 0;
  const hasHandledDefaultWorkspace = useRef(false);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(!hasDefaultWorkspace);

  const openTodayNote = useCallback(async (workspaceName: string) => {
    try {
      await open(buildDailyUri(workspaceName));
      await popToRoot({ clearSearchBar: true });
      await closeMainWindow({ clearRootSearch: true });
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Open Today's Note",
      });
    }
  }, []);

  const { data: workspaceResult, isLoading } = usePromise(
    async () => {
      const result = await loadWorkspaces();
      if (!result.fromCache && result.invalidRoots.length > 0) {
        const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
        await showToast({
          style: Toast.Style.Failure,
          title: "Some workspace roots were skipped",
          message: `${result.invalidRoots.length} ${noun} could not be read.`,
        });
      }

      return result;
    },
    [],
    {
      onError: async () => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Load Workspaces",
        });
      },
    },
  );

  useEffect(() => {
    if (!hasDefaultWorkspace || hasHandledDefaultWorkspace.current || !workspaceResult) {
      return;
    }

    hasHandledDefaultWorkspace.current = true;
    const workspaceExists = workspaceResult.workspaces.some((workspace) => workspace.name === defaultWorkspaceName);

    if (!workspaceExists) {
      void showToast({
        style: Toast.Style.Failure,
        title: `Workspace "${defaultWorkspaceName}" not found`,
      });
      setShowWorkspaceSelector(true);
      return;
    }

    void openTodayNote(defaultWorkspaceName);
  }, [defaultWorkspaceName, hasDefaultWorkspace, openTodayNote, workspaceResult]);

  if (!showWorkspaceSelector) {
    return <List isLoading={isLoading} />;
  }

  const workspaces = workspaceResult?.workspaces ?? [];

  return (
    <WorkspaceMenu
      isLoading={isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Select an Octarine workspace..."
      renderActions={(workspace) => (
        <ActionPanel>
          <Action title="Open Today's Note" onAction={() => void openTodayNote(workspace.name)} />
        </ActionPanel>
      )}
    />
  );
}
