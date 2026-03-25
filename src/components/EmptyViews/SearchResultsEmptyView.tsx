import { ActionPanel } from "@raycast/api";
import type { ReactNode } from "react";
import { CollectionEmptyView, type EmptyViewDisplay } from "./CollectionEmptyView";
import { match } from "../../utils/match";

type SearchSubject = "attachments" | "notes" | "views";

type SearchResultsEmptyViewProps = {
  children?: ReactNode;
  resource: SearchSubject;
  display?: EmptyViewDisplay;
};

export function SearchResultsEmptyView({ children, resource, display = "list" }: SearchResultsEmptyViewProps) {
  const actions = children ? <ActionPanel>{children}</ActionPanel> : undefined;

  return match(resource, {
    attachments: () => (
      <CollectionEmptyView
        display={display}
        title="No Matching Attachments"
        description="Try a different type filter or search text."
        actions={actions}
      />
    ),
    notes: () => <CollectionEmptyView display={display} title="No Matching Notes" actions={actions} />,
    views: () => <CollectionEmptyView display={display} title="No Matching Views" actions={actions} />,
  });
}
