import { ActionPanel, Grid, List } from "@raycast/api";
import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export function SearchAttachmentsEmptyView({ children }: Props) {
  const actions = children ? <ActionPanel>{children}</ActionPanel> : undefined;

  return (
    <Grid.EmptyView
      title="No Matching Attachments"
      description="Try a different type filter or search text."
      actions={actions}
    />
  );
}

export function SearchNotesEmptyView({ children }: Props) {
  const actions = children ? <ActionPanel>{children}</ActionPanel> : undefined;

  return <List.EmptyView title="No Matching Notes" actions={actions} />;
}

export function SearchViewsEmptyView({ children }: Props) {
  const actions = children ? <ActionPanel>{children}</ActionPanel> : undefined;

  return <List.EmptyView title="No Matching Views" actions={actions} />;
}
