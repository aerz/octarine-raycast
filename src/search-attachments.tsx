import { Action, ActionPanel, Icon, Grid, Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchResultsEmptyView } from "./components/empty-views/SearchResultsEmptyView";
import { WorkspaceContentEmptyView } from "./components/empty-views/WorkspaceContentEmptyView";
import { WorkspaceNotFound } from "./components/empty-views/WorkspaceNotFound";
import { buildSearchUri, openOctarineUri } from "./lib/octarine";
import { getSearchAttachmentsPreferences } from "./lib/preferences";
import { matchesSearchIndex } from "./lib/search";
import { isIndexedAttachment, type IndexedAttachment } from "./types/attachment";
import { type AttachmentScanResult, scanAttachments } from "./lib/attachments";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

function getGridItemContent(file: IndexedAttachment): Grid.Item.Props["content"] {
  if (IMAGE_EXTENSIONS.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}

function renderAttachmentActions(file: IndexedAttachment) {
  return (
    <ActionPanel>
      <Action
        title="Search in Octarine"
        icon={Icon.Globe}
        onAction={() => void openOctarineUri(buildSearchUri(file.name, file.workspace.name))}
      />
      <Action.Open title="Open File" target={file.path} shortcut={{ modifiers: ["cmd"], key: "return" }} />
      <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
      <Action.CopyToClipboard title="Copy File Path" content={file.path} shortcut={{ modifiers: ["cmd"], key: "." }} />
    </ActionPanel>
  );
}

export default function SearchAttachmentsCommand() {
  const preferences = useMemo(() => getSearchAttachmentsPreferences(), []);
  const {
    extension: extensionPreferences,
    showWorkspaceAttachmentCount,
    hideWorkspaceSections,
    excludeFileExtensions,
    excludeFileExtensionsSignature,
  } = preferences;
  const shouldShowWorkspaceAttachmentCount = showWorkspaceAttachmentCount && !hideWorkspaceSections;
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const loadingToastRef = useRef<Toast | undefined>(undefined);
  const hasShownSectionWarningRef = useRef(false);
  const isTypeFilterActive = selectedExtension !== "all";
  const hasConfiguredRoots = extensionPreferences.hasConfiguredRoots;

  const { data: scanResult, isLoading } = useCachedPromise(
    async (excludeFileExtensionsSignature: string): Promise<AttachmentScanResult> => {
      void excludeFileExtensionsSignature;
      return scanAttachments({ excludedExtensions: excludeFileExtensions });
    },
    [excludeFileExtensionsSignature],
    {
      initialData: { attachments: [], workspaceCount: 0 } satisfies AttachmentScanResult,
      onError: async (error) => {
        if (loadingToastRef.current) {
          await loadingToastRef.current.hide();
          loadingToastRef.current = undefined;
        }

        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to scan attachments",
          message: error.message,
        });
      },
    },
  );

  const attachments = useMemo(
    () => (scanResult?.attachments ?? []).filter((file): file is IndexedAttachment => isIndexedAttachment(file)),
    [scanResult],
  );
  const hasValidWorkspaces = (scanResult?.workspaceCount ?? 0) > 0;

  useEffect(() => {
    let disposed = false;

    const syncLoadingToast = async () => {
      if (isLoading) {
        if (!loadingToastRef.current) {
          const loadingToast = await showToast({
            style: Toast.Style.Animated,
            title: "Scanning attachments…",
          });

          if (disposed || !isLoading) {
            await loadingToast.hide();
            return;
          }

          loadingToastRef.current = loadingToast;
        }
        return;
      }

      if (loadingToastRef.current) {
        await loadingToastRef.current.hide();
        loadingToastRef.current = undefined;
      }
    };

    void syncLoadingToast();

    return () => {
      disposed = true;
      if (loadingToastRef.current) {
        void loadingToastRef.current.hide();
        loadingToastRef.current = undefined;
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (!hideWorkspaceSections || !showWorkspaceAttachmentCount || isLoading || hasShownSectionWarningRef.current) {
      return;
    }

    hasShownSectionWarningRef.current = true;
    void showToast({
      style: Toast.Style.Failure,
      title: "Workspace counts are hidden",
      message: 'Disable "Hide Workspace Sections" to show workspace attachment counts.',
    });
  }, [hideWorkspaceSections, isLoading, showWorkspaceAttachmentCount]);

  const extensionOptions = useMemo(() => {
    const uniqueExtensions = new Set<string>();
    for (const file of attachments) {
      if (file.extension) {
        uniqueExtensions.add(file.extension);
      }
    }

    return Array.from(uniqueExtensions).sort((left, right) => left.localeCompare(right));
  }, [attachments]);

  const extensionFilteredAttachments = useMemo(() => {
    if (!isTypeFilterActive) {
      return attachments;
    }

    return attachments.filter((file) => file.extension === selectedExtension);
  }, [attachments, isTypeFilterActive, selectedExtension]);

  const visibleAttachments = useMemo(() => {
    if (!isTypeFilterActive) {
      return extensionFilteredAttachments;
    }

    return extensionFilteredAttachments.filter((file) => matchesSearchIndex(file.searchText, searchText));
  }, [extensionFilteredAttachments, isTypeFilterActive, searchText]);

  const sections = useMemo(() => {
    const grouped = new Map<string, { workspaceName: string; files: IndexedAttachment[] }>();
    for (const file of visibleAttachments) {
      const existing = grouped.get(file.workspace.path);
      if (existing) {
        existing.files.push(file);
      } else {
        grouped.set(file.workspace.path, {
          workspaceName: file.workspace.name,
          files: [file],
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([workspacePath, value]) => ({
        workspacePath,
        workspaceName: value.workspaceName,
        files: value.files,
      }))
      .sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
  }, [visibleAttachments]);
  const showWorkspaceNotFound = !isLoading && (!hasConfiguredRoots || !hasValidWorkspaces);
  const showNoAttachmentsFound = !isLoading && !showWorkspaceNotFound && attachments.length === 0;
  const showNoMatchingAttachments =
    !isLoading && !showWorkspaceNotFound && attachments.length > 0 && sections.length === 0;
  const showAttachmentResults = !showWorkspaceNotFound && !showNoAttachmentsFound && !showNoMatchingAttachments;

  const searchBarPlaceholder = attachments.length === 0 ? "No attachments found" : "Search attachments...";

  return (
    <Grid
      columns={5}
      fit={Grid.Fit.Fill}
      filtering={!isTypeFilterActive}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={searchBarPlaceholder}
      searchBarAccessory={
        <Grid.Dropdown tooltip="Filter by file type" value={selectedExtension} onChange={setSelectedExtension}>
          <Grid.Dropdown.Item title="All Types" value="all" />
          {extensionOptions.map((extension) => (
            <Grid.Dropdown.Item key={extension} title={extension.toUpperCase()} value={extension} />
          ))}
        </Grid.Dropdown>
      }
    >
      {showWorkspaceNotFound ? <WorkspaceNotFound display="grid" /> : null}
      {showNoAttachmentsFound ? <WorkspaceContentEmptyView resource="attachments" display="grid" /> : null}

      {showNoMatchingAttachments ? (
        <SearchResultsEmptyView resource="attachments" display="grid">
          <Action
            title="Clear Type Filter"
            onAction={() => {
              setSelectedExtension("all");
              setSearchText("");
            }}
          />
        </SearchResultsEmptyView>
      ) : null}

      {showAttachmentResults && hideWorkspaceSections
        ? visibleAttachments.map((file) => (
            <Grid.Item
              key={file.path}
              title={file.name}
              subtitle={file.extension.toUpperCase()}
              content={getGridItemContent(file)}
              quickLook={{ name: file.name, path: file.path }}
              keywords={[file.workspace.name, file.extension]}
              actions={renderAttachmentActions(file)}
            />
          ))
        : showAttachmentResults
          ? sections.map((section) => (
              <Grid.Section
                key={section.workspacePath}
                title={
                  shouldShowWorkspaceAttachmentCount
                    ? `${section.workspaceName} (${section.files.length})`
                    : section.workspaceName
                }
              >
                {section.files.map((file) => (
                  <Grid.Item
                    key={file.path}
                    title={file.name}
                    subtitle={file.extension.toUpperCase()}
                    content={getGridItemContent(file)}
                    quickLook={{ name: file.name, path: file.path }}
                    keywords={[file.workspace.name, file.extension]}
                    actions={renderAttachmentActions(file)}
                  />
                ))}
              </Grid.Section>
            ))
          : null}
    </Grid>
  );
}
