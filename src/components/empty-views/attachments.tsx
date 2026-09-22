import { Grid, Icon } from "@raycast/api";
import type { ReactNode } from "react";

type Props = {
  actions?: ReactNode;
};

export function AttachmentsEmptyView({ actions }: Props) {
  return (
    <Grid.EmptyView
      icon={Icon.Paperclip}
      title="No Attachments Found"
      description="Attach a file to any note in Octarine to see it here."
      actions={actions}
    />
  );
}
