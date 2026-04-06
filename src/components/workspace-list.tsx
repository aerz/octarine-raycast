import { Action, ActionPanel, Clipboard, Icon, List, openExtensionPreferences } from "@raycast/api";
import type { ReactNode } from "react";
import type { Workspace } from "../types/octarine";
import type { ScanWorkspacesResult } from "../lib/workspaces";
import { WorkspaceListEmptyView } from "./empty-views/workspace";

type Props = {
  isLoading: boolean;
  workspaces: Workspace[];
  onRefresh: () => void | Promise<ScanWorkspacesResult>;
  children: (workspace: Workspace) => ReactNode;
};

export function WorkspaceList({ isLoading, workspaces, onRefresh, children }: Props) {
  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search workspaces">
      {workspaces.length === 0 && !isLoading ? (
        <WorkspaceListEmptyView>
          <Action title="Refresh Workspaces" icon={Icon.ArrowClockwise} onAction={onRefresh} />
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
                <Action title="Refresh Workspaces" icon={Icon.ArrowClockwise} onAction={onRefresh} />
                <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
