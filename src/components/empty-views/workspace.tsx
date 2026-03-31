import { Action, ActionPanel, Icon, openExtensionPreferences, List, Grid } from "@raycast/api";
import type { ReactNode } from "react";

function props(children?: ReactNode) {
  return {
    title: "No Octarine Workspaces Found",
    description:
      "Check Workspace Root Paths in extension preferences. A valid workspace must contain a .octarine folder.",
    actions: (
      <ActionPanel>
        {children}
        <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
      </ActionPanel>
    ),
  };
}

export function WorkspaceListEmptyView({ children }: { children?: ReactNode }) {
  return <List.EmptyView {...props(children)} />;
}

export function WorkspaceGridEmptyView({ children }: { children?: ReactNode }) {
  return <Grid.EmptyView {...props(children)} />;
}
