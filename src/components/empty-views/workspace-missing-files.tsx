import { Grid, List } from "@raycast/api";

export function WorkspaceAttachmentsEmptyView() {
  return (
    <Grid.EmptyView
      title="No Attachments Found"
      description="Add files to a workspace .attachments or .files folder and try again."
    />
  );
}

export function WorkspaceNotesEmptyView() {
  return <List.EmptyView title="No Notes Found" />;
}
