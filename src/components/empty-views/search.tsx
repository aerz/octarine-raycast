import { Grid, List } from "@raycast/api";
import type { ReactNode } from "react";

type Props = {
  actions?: ReactNode;
};

export function SearchAttachmentsEmptyView({ actions }: Props) {
  return (
    <Grid.EmptyView title="No attachments found" description="Try a different search or filter" actions={actions} />
  );
}

export function SearchNotesEmptyView({ actions }: Props) {
  return <List.EmptyView title="No notes found" description="Try a different search" actions={actions} />;
}
