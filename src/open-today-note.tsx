import {
  Action,
  ActionPanel,
  LaunchProps,
  List,
  Toast,
  getPreferenceValues,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { buildDailyNoteUri, openOctarineUri } from "./lib/octarine";
import { loadWorkspaces } from "./lib/workspaces";

type CommandPreferences = {
  workspaceName?: string;
};

type OpenTodayNoteArguments = {
  workspace?: string;
};

export default function OpenTodayNoteCommand(props: LaunchProps<{ arguments: OpenTodayNoteArguments }>) {
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const hasRequestedWorkspace = requestedWorkspace.length > 0;
  const preferences = getPreferenceValues<CommandPreferences>();
  const defaultWorkspaceName = preferences.workspaceName?.trim() ?? "";
  const targetWorkspaceName = hasRequestedWorkspace ? requestedWorkspace : defaultWorkspaceName;
  const hasTargetWorkspace = targetWorkspaceName.length > 0;
  const hasHandledDefaultWorkspace = useRef(false);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(!hasTargetWorkspace);

  const openTodayNote = useCallback(async (workspaceName: string) => {
    const octarineUri = buildDailyNoteUri("today", workspaceName);
    await openOctarineUri(octarineUri);
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
    if (!hasTargetWorkspace || hasHandledDefaultWorkspace.current || !workspaceResult) {
      return;
    }

    hasHandledDefaultWorkspace.current = true;
    const workspaceExists = workspaceResult.workspaces.some((workspace) => workspace.name === targetWorkspaceName);

    if (!workspaceExists) {
      void showToast({
        style: Toast.Style.Failure,
        title: `Workspace ${targetWorkspaceName} not found`,
      });
      setShowWorkspaceSelector(true);
      return;
    }

    void openTodayNote(targetWorkspaceName);
  }, [hasTargetWorkspace, openTodayNote, targetWorkspaceName, workspaceResult]);

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
