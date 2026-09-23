import { Grid } from "@raycast/api";
import { useState } from "react";
import { AttachmentsEmptyView, SearchAttachmentsEmptyView } from "./components/empty-views";
import { AttachmentActions, AttachmentsGrid, EmptyAttachmentsActions, ExtensionDropdown } from "./components/grid";
import { useAttachments } from "./hooks/use-attachments";
import { useWorkspaces } from "@hooks/use-workspaces";
import { searchAttachmentsPreferences } from "@lib/preferences";
import { ALL_EXTENSIONS } from "@type/attachments";

export default function SearchAttachmentsCommand() {
  const preferences = searchAttachmentsPreferences();
  const [selectedExtension, setSelectedExtension] = useState(ALL_EXTENSIONS);
  const [searchText, setSearchText] = useState("");
  const [refresh, setRefresh] = useState(false);
  const {
    workspaces,
    status: { isLoading: isWorkspacesLoading },
    revalidate: revalidateWorkspaces,
  } = useWorkspaces({ refresh });
  const { dropdown, sections, isLoading, revalidate } = useAttachments({
    workspaces,
    enabled: !isWorkspacesLoading,
    excludedExtensions: preferences.excludedExtensions,
    searchText,
    selectedExtension,
    refresh,
  });
  const hasResults = sections.some((section) => section.attachments.length > 0);
  const onRefresh = () => {
    if (refresh) {
      void revalidateWorkspaces();
      revalidate();
    } else {
      setRefresh(true);
    }
  };

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search attachments"
      searchBarAccessory={
        <ExtensionDropdown extensions={dropdown} value={selectedExtension} onChange={setSelectedExtension} />
      }
    >
      {dropdown.length === 0 ? (
        <AttachmentsEmptyView actions={<EmptyAttachmentsActions onRefresh={onRefresh} />} />
      ) : !hasResults ? (
        <SearchAttachmentsEmptyView actions={<AttachmentActions onRefresh={onRefresh} />} />
      ) : selectedExtension === ALL_EXTENSIONS && !preferences.flattenWorkspaceSections ? (
        <AttachmentsGrid
          grouped
          sections={sections}
          showWorkspaceAttachmentCount={preferences.showWorkspaceAttachmentCount}
          onRefresh={onRefresh}
        />
      ) : (
        <AttachmentsGrid sections={sections} onRefresh={onRefresh} />
      )}
    </Grid>
  );
}
