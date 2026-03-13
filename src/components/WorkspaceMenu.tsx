import { List } from "@raycast/api";
import type { ReactNode } from "react";
import type { Workspace } from "../types/octarine";
import { WorkspaceNotFound } from "./empty-views/WorkspaceNotFound";

type WorkspaceMenuProps = {
  isLoading: boolean;
  workspaces: Workspace[];
  searchBarPlaceholder: string;
  renderActions: (workspace: Workspace) => ReactNode;
  emptyView?: ReactNode;
};

export function WorkspaceMenu({
  isLoading,
  workspaces,
  searchBarPlaceholder,
  renderActions,
  emptyView,
}: WorkspaceMenuProps) {
  return (
    <List isLoading={isLoading} searchBarPlaceholder={searchBarPlaceholder}>
      {workspaces.length === 0 && !isLoading
        ? (emptyView ?? <WorkspaceNotFound />)
        : workspaces.map((workspace) => (
            <List.Item
              key={workspace.path}
              title={workspace.name}
              subtitle={workspace.path}
              actions={renderActions(workspace)}
            />
          ))}
    </List>
  );
}
