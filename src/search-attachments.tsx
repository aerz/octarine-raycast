import { Action, Grid } from "@raycast/api";
import { useState } from "react";
import { AttachmentGridItem } from "./components/AttachmentGridItem";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { useAttachments } from "./hooks/useAttachments";
import { getSearchAttachmentsPreferences } from "./lib/preferences";

type ViewState = "loading" | "workspace-not-found" | "no-attachments" | "no-matching-attachments" | "results";

function assertNever(value: never): never {
  throw new Error(`Unhandled view state: ${String(value)}`);
}

function getViewState({
  isLoading,
  hasConfiguredRoots,
  hasValidWorkspaces,
  attachmentCount,
  visibleAttachmentCount,
}: {
  isLoading: boolean;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  attachmentCount: number;
  visibleAttachmentCount: number;
}): ViewState {
  if (isLoading && attachmentCount === 0) {
    return "loading";
  }

  if (!hasConfiguredRoots || !hasValidWorkspaces) {
    return "workspace-not-found";
  }

  if (attachmentCount === 0) {
    return "no-attachments";
  }

  if (visibleAttachmentCount === 0) {
    return "no-matching-attachments";
  }

  return "results";
}

export default function SearchAttachmentsCommand() {
  const preferences = getSearchAttachmentsPreferences();
  const [fileExtensionFilter, setFileExtensionFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const { attachments, visibleAttachments, sections, filters, isLoading, hasValidWorkspaces } = useAttachments({
    excludedExtensions: preferences.excludedExtensions,
    excludedDirectoryNames: preferences.extension.excludedFoldersInWorkspaces,
    workspaceSearchSignature: preferences.extension.workspaceSearchSignature,
    excludedExtensionsSignature: preferences.excludedExtensionsSignature,
    searchText,
    fileExtensionFilter,
  });
  const viewState = getViewState({
    isLoading,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
    hasValidWorkspaces,
    attachmentCount: attachments.length,
    visibleAttachmentCount: visibleAttachments.length,
  });

  function renderContent() {
    switch (viewState) {
      case "loading":
        return null;
      case "workspace-not-found":
        return <WorkspaceNotFound display="grid" />;
      case "no-attachments":
        return <WorkspaceContentEmptyView resource="attachments" display="grid" />;
      case "no-matching-attachments":
        return (
          <SearchResultsEmptyView resource="attachments" display="grid">
            <Action
              title="Clear Extension Filter"
              onAction={() => {
                setFileExtensionFilter("all");
                setSearchText("");
              }}
            />
          </SearchResultsEmptyView>
        );
      case "results":
        if (preferences.flattenWorkspaceSections) {
          return visibleAttachments.map((file) => <AttachmentGridItem key={file.path} file={file} />);
        }

        return sections.map((section) => (
          <Grid.Section
            key={section.workspacePath}
            title={
              preferences.showWorkspaceAttachmentCount
                ? `${section.workspaceName} (${section.files.length})`
                : section.workspaceName
            }
          >
            {section.files.map((file) => (
              <AttachmentGridItem key={file.path} file={file} />
            ))}
          </Grid.Section>
        ));
      default:
        return assertNever(viewState);
    }
  }

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={fileExtensionFilter === "all"}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments..."
      searchBarAccessory={
        <Grid.Dropdown tooltip="Filter by file extension" value={fileExtensionFilter} onChange={setFileExtensionFilter}>
          <Grid.Dropdown.Item title="All Extensions" value="all" />
          {filters.map((extension) => (
            <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
          ))}
        </Grid.Dropdown>
      }
    >
      {renderContent()}
    </Grid>
  );
}
