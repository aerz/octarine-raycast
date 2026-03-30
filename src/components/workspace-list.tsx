import { Action, ActionPanel, Clipboard, Icon, List, openExtensionPreferences } from "@raycast/api";
import type { ReactNode } from "react";
import type { Workspace } from "../types/octarine";
import { WorkspaceListEmptyView } from "./empty-views/workspace";

type Props = {
  isLoading: boolean;
  workspaces: Workspace[];
  onRescan: () => void | Promise<unknown>;
  children: (workspace: Workspace) => ReactNode;
};

export function WorkspaceList({ isLoading, workspaces, onRescan, children }: Props) {
  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search workspaces">
      {workspaces.length === 0 && !isLoading ? (
        <WorkspaceListEmptyView>
          <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={onRescan} />
        </WorkspaceListEmptyView>
      ) : (
        workspaces.map((workspace) => (
          <List.Item
            key={workspace.path}
            title={workspace.name}
            subtitle={workspace.path}
            actions={
              <ActionPanel>
                {children(workspace)}
                <Action title="Copy Path" icon={Icon.Clipboard} onAction={() => Clipboard.copy(workspace.path)} />
                <Action title="Rescan Workspaces" icon={Icon.ArrowClockwise} onAction={onRescan} />
                <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
