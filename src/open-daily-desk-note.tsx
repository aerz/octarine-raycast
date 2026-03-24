import {
  Action,
  ActionPanel,
  LaunchProps,
  Toast,
  showToast,
  Clipboard,
  Icon,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect } from "react";
import { DateFormatsDetail } from "./components/Notifications/DateFormatsDetail";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useOpenDailyDeskNote } from "./hooks/useOpenDailyDeskNote";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { isSupportedDailyDeskDate } from "./lib/daily-desk";
import { openOctarineDailyDeskNote } from "./lib/octarine";
import type { Workspace } from "./types/octarine";

type Arguments = {
  date: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const isValidDate = isSupportedDailyDeskDate(requestedDate);

  const {
    workspaces,
    status: workspaceStatus,
    revalidate,
  } = useWorkspaces({
    enabled: isValidDate,
  });
  const { shouldHideMenu } = useOpenDailyDeskNote({
    date: requestedDate,
    requestedWorkspace,
    workspaces,
    status: workspaceStatus,
    enabled: isValidDate,
  });

  useEffect(() => {
    if (!isValidDate) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid date",
        message: "Use a supported Octarine date format",
      });
    }
  }, []);

  if (!isValidDate) {
    return <DateFormatsDetail />;
  }

  if (shouldHideMenu) {
    return null;
  }

  return (
    <WorkspaceMenu
      isLoading={workspaceStatus.isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Search Octarine workspaces..."
      renderActions={(workspace: Workspace) => (
        <ActionPanel>
          <Action
            title="Open Daily Desk Note"
            onAction={() => openOctarineDailyDeskNote(requestedDate, workspace.name)}
          />
          <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
          <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => Clipboard.copy(workspace.path)} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      )}
    />
  );
}
