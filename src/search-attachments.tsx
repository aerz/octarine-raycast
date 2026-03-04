import {
  Action,
  ActionPanel,
  Icon,
  Grid,
  Toast,
  getPreferenceValues,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentFile } from "./types";
import { scanAttachmentsFromPreferences } from "./utils/attachments";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

function matchesSearchQuery(file: AttachmentFile, searchText: string): boolean {
  const normalizedQuery = searchText.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  const searchableText = `${file.name} ${file.workspaceName} ${file.extension}`.toLowerCase();
  return tokens.every((token) => searchableText.includes(token));
}

function getGridItemContent(file: AttachmentFile): Grid.Item.Props["content"] {
  if (IMAGE_EXTENSIONS.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}

export default function SearchAttachmentsCommand() {
  const preferences = getPreferenceValues<{
    showWorkspaceAttachmentCount?: boolean;
    hideWorkspaceSections?: boolean;
    excludeFileExtensions?: string;
  }>();
  const showWorkspaceAttachmentCount = preferences.showWorkspaceAttachmentCount ?? false;
  const hideWorkspaceSections = preferences.hideWorkspaceSections ?? false;
  const excludeFileExtensions = preferences.excludeFileExtensions ?? "";
  const shouldShowWorkspaceAttachmentCount = showWorkspaceAttachmentCount && !hideWorkspaceSections;
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const loadingToastRef = useRef<Toast | undefined>(undefined);
  const hasShownSectionWarningRef = useRef(false);
  const isTypeFilterActive = selectedExtension !== "all";

  const { data: attachments = [], isLoading } = useCachedPromise(
    scanAttachmentsFromPreferences,
    [excludeFileExtensions],
    {
      initialData: [],
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

    return extensionFilteredAttachments.filter((file) => matchesSearchQuery(file, searchText));
  }, [extensionFilteredAttachments, isTypeFilterActive, searchText]);

  const sections = useMemo(() => {
    const grouped = new Map<string, { workspaceName: string; files: AttachmentFile[] }>();
    for (const file of visibleAttachments) {
      const existing = grouped.get(file.workspacePath);
      if (existing) {
        existing.files.push(file);
      } else {
        grouped.set(file.workspacePath, {
          workspaceName: file.workspaceName,
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
      {attachments.length === 0 && !isLoading ? (
        <Grid.EmptyView
          title="No Attachments Found"
          description="Add files to a workspace .attachments folder and try again."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={() => void openCommandPreferences()} />
            </ActionPanel>
          }
        />
      ) : null}

      {attachments.length > 0 && sections.length === 0 && !isLoading ? (
        <Grid.EmptyView
          title="No Matching Attachments"
          description="Try a different type filter or search text."
          actions={
            <ActionPanel>
              <Action
                title="Clear Type Filter"
                onAction={() => {
                  setSelectedExtension("all");
                  setSearchText("");
                }}
              />
            </ActionPanel>
          }
        />
      ) : null}

      {hideWorkspaceSections
        ? visibleAttachments.map((file) => (
            <Grid.Item
              key={file.path}
              title={file.name}
              subtitle={file.extension.toUpperCase()}
              content={getGridItemContent(file)}
              quickLook={{ name: file.name, path: file.path }}
              keywords={[file.workspaceName, file.extension]}
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Search in Octarine"
                    target={`octarine://search?query=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(file.workspaceName)}`}
                    icon={Icon.Globe}
                  />
                  <Action.Open title="Open File" target={file.path} shortcut={{ modifiers: ["cmd"], key: "return" }} />
                  <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
                  <Action.CopyToClipboard
                    title="Copy File Path"
                    content={file.path}
                    shortcut={{ modifiers: ["cmd"], key: "." }}
                  />
                </ActionPanel>
              }
            />
          ))
        : sections.map((section) => (
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
                  keywords={[file.workspaceName, file.extension]}
                  actions={
                    <ActionPanel>
                      <Action.Open
                        title="Search in Octarine"
                        target={`octarine://search?query=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(file.workspaceName)}`}
                        icon={Icon.Globe}
                      />
                      <Action.Open
                        title="Open File"
                        target={file.path}
                        shortcut={{ modifiers: ["cmd"], key: "return" }}
                      />
                      <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
                      <Action.CopyToClipboard
                        title="Copy File Path"
                        content={file.path}
                        shortcut={{ modifiers: ["cmd"], key: "." }}
                      />
                    </ActionPanel>
                  }
                />
              ))}
            </Grid.Section>
          ))}
    </Grid>
  );
}
