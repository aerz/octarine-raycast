import { Action, ActionPanel, Icon, openExtensionPreferences } from "@raycast/api";
import type { ReactNode } from "react";
import { CollectionEmptyView, type EmptyViewDisplay } from "./CollectionEmptyView";

type WorkspaceNotFoundProps = {
  children?: ReactNode;
  display?: EmptyViewDisplay;
};

export function WorkspaceNotFound({ children, display = "list" }: WorkspaceNotFoundProps) {
  return (
    <CollectionEmptyView
      display={display}
      title="No Octarine Workspaces Found"
      description="Check Workspace Root Paths in extension preferences. A valid workspace must contain a .octarine folder."
      actions={
        <ActionPanel>
          {children}
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}
