import { CollectionEmptyView, type EmptyViewDisplay } from "./CollectionEmptyView";
import { match } from "../../utils/match";

type WorkspaceContentSubject = "attachments" | "notes" | "views";

type WorkspaceContentEmptyViewProps = {
  resource: WorkspaceContentSubject;
  display?: EmptyViewDisplay;
};

export function WorkspaceContentEmptyView({ resource, display = "list" }: WorkspaceContentEmptyViewProps) {
  return match(resource, {
    attachments: () => (
      <CollectionEmptyView
        display={display}
        title="No Attachments Found"
        description="Add files to a workspace .attachments or .files folder and try again."
      />
    ),
    notes: () => <CollectionEmptyView display={display} title="No Notes Found" />,
    views: () => (
      <CollectionEmptyView
        display={display}
        title="No Views Found"
        description="No workspace contains a .octarine/views.json file with views."
      />
    ),
  });
}
