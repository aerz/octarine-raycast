import { ActionPanel } from "@raycast/api";
import type { ReactNode } from "react";
import { CollectionEmptyView, type EmptyViewDisplay } from "./CollectionEmptyView";

type SearchSubject = "attachments" | "notes" | "views";

type SearchResultsEmptyViewProps = {
  children?: ReactNode;
  resource: SearchSubject;
  display?: EmptyViewDisplay;
};

export function SearchResultsEmptyView({ children, resource, display = "list" }: SearchResultsEmptyViewProps) {
  const actions = children ? <ActionPanel>{children}</ActionPanel> : undefined;

  switch (resource) {
    case "attachments":
      return (
        <CollectionEmptyView
          display={display}
          title="No Matching Attachments"
          description="Try a different type filter or search text."
          actions={actions}
        />
      );

    case "notes":
      return <CollectionEmptyView display={display} title="No Matching Notes" actions={actions} />;

    case "views":
      return <CollectionEmptyView display={display} title="No Matching Views" actions={actions} />;
  }
}
