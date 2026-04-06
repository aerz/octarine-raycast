import { ActionPanel, Grid, List } from "@raycast/api";
import type { ReactNode } from "react";

type Props = {
  actions?: ReactNode;
  children?: ReactNode;
};

export function SearchAttachmentsEmptyView({ actions, children }: Props) {
  return (
    <Grid.EmptyView
      title="No attachments found"
      description="Try a different search or filter"
      actions={actions ?? (children ? <ActionPanel>{children}</ActionPanel> : undefined)}
    />
  );
}

export function SearchNotesEmptyView({ actions, children }: Props) {
  return (
    <List.EmptyView
      title="No notes found"
      description="Try a different search"
      actions={actions ?? (children ? <ActionPanel>{children}</ActionPanel> : undefined)}
    />
  );
}

export function SearchViewsEmptyView({ actions, children }: Props) {
  return (
    <List.EmptyView
      title="No views found"
      description="Try a different search"
      actions={actions ?? (children ? <ActionPanel>{children}</ActionPanel> : undefined)}
    />
  );
}
