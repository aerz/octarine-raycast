import { Action, Grid } from "@raycast/api";
import { useState } from "react";
import { AttachmentGridItem } from "./components/AttachmentGridItem";
import { SearchResultsEmptyView } from "./components/EmptyViews/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/EmptyViews/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/EmptyViews/WorkspaceNotFound";
import { type AttachmentSection, useAttachments } from "./hooks/useAttachments";
import { getSearchAttachmentsPreferences } from "./lib/preferences";
import { match } from "./utils/match";

export default function SearchAttachmentsCommand() {
  const preferences = getSearchAttachmentsPreferences();
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const { visibleAttachments, sections, filters, searchState, isLoading } = useAttachments({
    excludedExtensions: preferences.excludedExtensions,
    excludedDirectoryNames: preferences.extension.excludedFoldersInWorkspaces,
    workspaceSearchSignature: preferences.extension.workspaceSearchSignature,
    excludedExtensionsSignature: preferences.excludedExtensionsSignature,
    hasConfiguredRoots: preferences.extension.hasConfiguredRoots,
    searchText,
    selectedExtension,
    flattenWorkspaceSections: preferences.flattenWorkspaceSections,
  });

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={selectedExtension === "all"}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments..."
      searchBarAccessory={
        <Grid.Dropdown tooltip="Filter by file extension" value={selectedExtension} onChange={setSelectedExtension}>
          <Grid.Dropdown.Item title="All Extensions" value="all" />
          {filters.map((extension) => (
            <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
          ))}
        </Grid.Dropdown>
      }
    >
      {match(searchState, {
        loading: () => null,
        noConfiguredWorkspaces: () => <WorkspaceNotFound display="grid" />,
        noAvailableAttachments: () => <WorkspaceContentEmptyView resource="attachments" display="grid" />,
        noMatchingAttachments: () => (
          <NoMatchingResultsView
            onClear={() => {
              setSelectedExtension("all");
              setSearchText("");
            }}
          />
        ),
        showFlat: () => visibleAttachments.map((file) => <AttachmentGridItem key={file.path} file={file} />),
        showByWorkspace: () => (
          <WorkspaceSectionGrid sections={sections} showWorkspaceAttachmentCount={preferences.showWorkspaceAttachmentCount} />
        ),
      })}
    </Grid>
  );
}

function NoMatchingResultsView({ onClear }: { onClear: () => void }) {
  return (
    <SearchResultsEmptyView resource="attachments" display="grid">
      <Action title="Clear Extension Filter" onAction={onClear} />
    </SearchResultsEmptyView>
  );
}

function WorkspaceSectionGrid({
  sections,
  showWorkspaceAttachmentCount,
}: {
  sections: AttachmentSection[];
  showWorkspaceAttachmentCount: boolean;
}) {
  return sections.map((section) => (
    <Grid.Section
      key={section.workspacePath}
      title={
        showWorkspaceAttachmentCount ? `${section.workspaceName} (${section.files.length})` : section.workspaceName
      }
    >
      {section.files.map((file) => (
        <AttachmentGridItem key={file.path} file={file} />
      ))}
    </Grid.Section>
  ));
}
