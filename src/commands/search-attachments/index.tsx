import { Grid } from "@raycast/api";
import { useState } from "react";
import { AttachmentsEmptyView, SearchAttachmentsEmptyView } from "./components/empty-views";
import { AttachmentActions, AttachmentsGrid, ExtensionDropdown } from "./components/grid";
import { useAttachments } from "./hooks/use-attachments";
import { useWorkspaces } from "@hooks/useWorkspaces";
import { searchAttachmentsPreferences } from "@lib/preferences";

export default function SearchAttachmentsCommand() {
  const preferences = searchAttachmentsPreferences();
  const [selectedExtension, setSelectedExtension] = useState("all");
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
        <AttachmentsEmptyView actions={<AttachmentActions onRefresh={onRefresh} />} />
      ) : !hasResults ? (
        <SearchAttachmentsEmptyView actions={<AttachmentActions onRefresh={onRefresh} />} />
      ) : selectedExtension === "all" ? (
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
