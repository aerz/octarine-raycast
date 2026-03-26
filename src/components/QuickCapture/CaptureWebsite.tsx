import { Action, ActionPanel, BrowserExtension, Icon, List, Toast, environment, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import path from "node:path";
import { CollectionEmptyView } from "../EmptyViews/CollectionEmptyView";
import { WorkspaceNotFound } from "../EmptyViews/WorkspaceNotFound";
import { type IndexedNoteFolder, scanNoteFoldersFromWorkspaces } from "../../lib/notes";
import { upsertOctarineNoteContent } from "../../lib/octarine";
import { matchesSearchIndex } from "../../lib/search";
import { loadWorkspaces } from "../../lib/workspaces";
import type { Workspace } from "../../types/octarine";
import { match } from "../../utils/match";
import { showCaptureFailureToast } from "./shared";

type CaptureWebsiteProps = {
  excludedDirectoryNames: Set<string>;
  hasConfiguredRoots: boolean;
};

type FolderPickerRenderState = "noConfiguredWorkspaces" | "noMatchingFolders" | "showByWorkspace" | "showFlat";

function getFolderPickerRenderState({
  hasWorkspaces,
  isLoading,
  searchFilteredFolderCount,
  selectedWorkspace,
}: {
  hasWorkspaces: boolean;
  isLoading: boolean;
  searchFilteredFolderCount: number;
  selectedWorkspace: string;
}): FolderPickerRenderState {
  if (!isLoading && !hasWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (!isLoading && searchFilteredFolderCount === 0) {
    return "noMatchingFolders";
  }

  if (selectedWorkspace === "all") {
    return "showByWorkspace";
  }

  return "showFlat";
}

function groupFoldersByWorkspace(folders: IndexedNoteFolder[]): Map<string, IndexedNoteFolder[]> {
  const groupedFolders = new Map<string, IndexedNoteFolder[]>();

  for (const folder of folders) {
    const workspaceName = folder.workspace.name;
    const foldersInWorkspace = groupedFolders.get(workspaceName);

    if (foldersInWorkspace) {
      foldersInWorkspace.push(folder);
    } else {
      groupedFolders.set(workspaceName, [folder]);
    }
  }

  return groupedFolders;
}

function buildNotePath(directoryPath: string, fileName: string): string {
  const normalizedFileName = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  return directoryPath ? path.posix.join(directoryPath, normalizedFileName) : normalizedFileName;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return sanitized || "Website Capture";
}

function buildWebsiteCaptureFileName(tabTitle?: string, tabUrl?: string): string {
  const fallbackTitle = (() => {
    if (!tabUrl) {
      return "Website Capture";
    }

    try {
      return new URL(tabUrl).hostname || "Website Capture";
    } catch {
      return "Website Capture";
    }
  })();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeFileName(tabTitle || fallbackTitle)} ${timestamp}`;
}

function FolderItem({
  folder,
  onCapture,
}: {
  folder: IndexedNoteFolder;
  onCapture: (folder: IndexedNoteFolder) => void;
}) {
  return (
    <List.Item
      icon={Icon.Folder}
      title={folder.name}
      subtitle={folder.path || "/"}
      keywords={[folder.path, folder.workspace.name]}
      actions={
        <ActionPanel>
          <Action title="Capture Website" onAction={() => onCapture(folder)} />
        </ActionPanel>
      }
    />
  );
}

export function CaptureWebsite({ excludedDirectoryNames, hasConfiguredRoots }: CaptureWebsiteProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<IndexedNoteFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const hasShownScanErrorToast = useRef(false);

  useEffect(() => {
    let canceled = false;

    const showScanFailureToast = async () => {
      if (hasShownScanErrorToast.current) {
        return;
      }

      hasShownScanErrorToast.current = true;
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Scan Some Folders",
      });
    };

    const scanFolders = async () => {
      setIsLoading(true);
      hasShownScanErrorToast.current = false;

      try {
        if (!hasConfiguredRoots) {
          if (!canceled) {
            setWorkspaces([]);
            setFolders([]);
          }
          return;
        }

        const workspaceResult = await loadWorkspaces({ forceRefresh: true });
        if (!canceled) {
          setWorkspaces(workspaceResult.workspaces);
        }

        if (workspaceResult.workspaces.length === 0) {
          if (!canceled) {
            setFolders([]);
          }
          return;
        }

        if (canceled) {
          return;
        }

        const discoveredFolders = await scanNoteFoldersFromWorkspaces(
          workspaceResult.workspaces,
          excludedDirectoryNames,
          showScanFailureToast,
        );

        if (!canceled) {
          setFolders(discoveredFolders);
        }
      } catch (error) {
        console.error("Failed to scan Octarine folders", error);
        await showCaptureFailureToast("Failed to Scan Folders");
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void scanFolders();

    return () => {
      canceled = true;
    };
  }, [excludedDirectoryNames, hasConfiguredRoots]);

  const workspaceNames = useMemo(
    () =>
      Array.from(new Set(folders.map((folder) => folder.workspace.name))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [folders],
  );
  const filteredFolders = useMemo(
    () => folders.filter((folder) => selectedWorkspace === "all" || folder.workspace.name === selectedWorkspace),
    [folders, selectedWorkspace],
  );
  const searchFilteredFolders = useMemo(
    () => filteredFolders.filter((folder) => matchesSearchIndex(folder.searchText, searchText)),
    [filteredFolders, searchText],
  );
  const foldersByWorkspace = useMemo(() => groupFoldersByWorkspace(searchFilteredFolders), [searchFilteredFolders]);
  const renderState = getFolderPickerRenderState({
    hasWorkspaces: workspaces.length > 0,
    isLoading,
    searchFilteredFolderCount: searchFilteredFolders.length,
    selectedWorkspace,
  });

  async function handleFolderSelection(folder: IndexedNoteFolder) {
    if (!environment.canAccess(BrowserExtension)) {
      await showCaptureFailureToast(
        "Browser Extension Required",
        "Install and enable the Raycast Browser Extension to capture websites.",
      );
      return;
    }

    const loadingToast = await showToast({
      style: Toast.Style.Animated,
      title: "Capturing Website…",
    });

    try {
      const [content, tabs] = await Promise.all([
        BrowserExtension.getContent({ format: "markdown" }),
        BrowserExtension.getTabs(),
      ]);
      const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

      if (!content.trim()) {
        loadingToast.style = Toast.Style.Failure;
        loadingToast.title = "Nothing to Capture";
        loadingToast.message = "The active tab did not return any readable content.";
        return;
      }

      const notePath = buildNotePath(folder.path, buildWebsiteCaptureFileName(activeTab?.title, activeTab?.url));
      const didOpen = await upsertOctarineNoteContent({
        path: notePath,
        workspaceName: folder.workspace.name,
        content,
      });

      if (!didOpen) {
        await loadingToast.hide();
        return;
      }

      loadingToast.style = Toast.Style.Success;
      loadingToast.title = "Website Captured";
    } catch (error) {
      loadingToast.style = Toast.Style.Failure;
      loadingToast.title = "Failed to Capture Website";
      loadingToast.message = error instanceof Error ? error.message : "Try again with an active browser tab.";
    }
  }

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Select a destination folder..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by workspace" value={selectedWorkspace} onChange={setSelectedWorkspace}>
          <List.Dropdown.Item title="All" value="all" />
          {workspaceNames.map((workspaceName) => (
            <List.Dropdown.Item key={workspaceName} title={workspaceName} value={workspaceName} />
          ))}
        </List.Dropdown>
      }
    >
      {match(renderState, {
        noConfiguredWorkspaces: () => <WorkspaceNotFound />,
        noMatchingFolders: () => (
          <CollectionEmptyView
            title="No Matching Folders"
            description="Try a different workspace filter or search text."
          />
        ),
        showByWorkspace: () =>
          workspaceNames.map((workspaceName) => {
            const foldersInWorkspace = foldersByWorkspace.get(workspaceName) ?? [];
            if (foldersInWorkspace.length === 0) {
              return null;
            }

            return (
              <List.Section key={workspaceName} title={workspaceName}>
                {foldersInWorkspace.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    onCapture={(selectedFolder) => void handleFolderSelection(selectedFolder)}
                  />
                ))}
              </List.Section>
            );
          }),
        showFlat: () =>
          searchFilteredFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              onCapture={(selectedFolder) => void handleFolderSelection(selectedFolder)}
            />
          )),
      })}
    </List>
  );
}
