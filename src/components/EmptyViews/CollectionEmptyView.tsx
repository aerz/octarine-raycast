import { Grid, List } from "@raycast/api";
import type { ReactNode } from "react";

export type EmptyViewDisplay = "list" | "grid";

type CollectionEmptyViewProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  display?: EmptyViewDisplay;
};

export function CollectionEmptyView({ title, description, actions, display = "list" }: CollectionEmptyViewProps) {
  const EmptyView = display === "grid" ? Grid.EmptyView : List.EmptyView;

  return <EmptyView title={title} description={description} actions={actions} />;
}
