import { Action, Icon } from "@raycast/api";
import { useState } from "react";
import { useOpenDailyNote } from "../../hooks/useOpenDailyNote";
import { useWorkspaces } from "../../hooks/useWorkspaces";
import { openDailyDeskNotePreferences } from "../../lib/preferences";
import { WorkspaceList } from "../workspace-list";

type Props = {
  date: string;
  requestedWorkspace: string;
};

export function DailyDeskOpen({ date, requestedWorkspace }: Props) {
  const preferences = openDailyDeskNotePreferences();
  const [refresh, setRefresh] = useState(false);
  const { workspaces, status, revalidate } = useWorkspaces({ refresh });
  const openDailyNote = useOpenDailyNote({
    date,
    requestedWorkspace: requestedWorkspace || preferences.defaultWorkspace,
    workspaces,
    status,
  });
  const onRefresh = () => (refresh ? revalidate() : setRefresh(true));

  return (
    <WorkspaceList isLoading={status.isLoading} workspaces={workspaces} onRefresh={onRefresh}>
      {(workspace) => (
        <Action
          title="Open Daily Desk Note"
          icon={Icon.AppWindow}
          onAction={() => void openDailyNote(date, workspace.name)}
        />
      )}
    </WorkspaceList>
  );
}
