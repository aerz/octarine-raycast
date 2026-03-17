import { CollectionEmptyView, type EmptyViewDisplay } from "./CollectionEmptyView";

type WorkspaceContentSubject = "attachments" | "notes" | "views";

type WorkspaceContentEmptyViewProps = {
  resource: WorkspaceContentSubject;
  display?: EmptyViewDisplay;
};

export function WorkspaceContentEmptyView({ resource, display = "list" }: WorkspaceContentEmptyViewProps) {
  switch (resource) {
    case "attachments":
      return (
        <CollectionEmptyView
          display={display}
          title="No Attachments Found"
          description="Add files to a workspace .attachments or .files folder and try again."
        />
      );

    case "notes":
      return <CollectionEmptyView display={display} title="No Notes Found" />;

    case "views":
      return (
        <CollectionEmptyView
          display={display}
          title="No Views Found"
          description="No workspace contains a .octarine/views.json file with views."
        />
      );
  }
}
