import { Toast, showToast } from "@raycast/api";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  type AttachmentsSnapshot,
  loadCachedAttachments,
  saveCachedAttachments,
  scanAttachments,
} from "../lib/attachments";
import { matchesSearchIndex } from "../lib/search";
import type { IndexedAttachment } from "../types/attachment";
import { useLoadingToast } from "./useLoadingToast";

export type AttachmentSection = {
  workspacePath: string;
  workspaceName: string;
  files: IndexedAttachment[];
};

type SearchState =
  | "loading"
  | "noConfiguredWorkspaces"
  | "noAvailableAttachments"
  | "noMatchingAttachments"
  | "showByWorkspace"
  | "showFlat";

type Options = {
  excludedExtensions: string[];
  excludedDirectoryNames: string[];
  workspaceSearchSignature: string;
  excludedExtensionsSignature: string;
  hasConfiguredRoots: boolean;
  searchText: string;
  selectedExtension: string;
  flattenWorkspaceSections: boolean;
};

type Result = {
  attachments: IndexedAttachment[];
  visibleAttachments: IndexedAttachment[];
  sections: AttachmentSection[];
  filters: string[];
  searchState: SearchState;
  isLoading: boolean;
};

const EMPTY_SCAN_RESULT: AttachmentsSnapshot = {
  attachments: [],
  workspaceCount: 0,
};

function getSearchState({
  isLoading,
  hasConfiguredRoots,
  hasValidWorkspaces,
  attachmentCount,
  visibleAttachmentCount,
  flattenWorkspaceSections,
}: {
  isLoading: boolean;
  hasConfiguredRoots: boolean;
  hasValidWorkspaces: boolean;
  attachmentCount: number;
  visibleAttachmentCount: number;
  flattenWorkspaceSections: boolean;
}): SearchState {
  if (isLoading && attachmentCount === 0) {
    return "loading";
  }

  if (!hasConfiguredRoots || !hasValidWorkspaces) {
    return "noConfiguredWorkspaces";
  }

  if (attachmentCount === 0) {
    return "noAvailableAttachments";
  }

  if (visibleAttachmentCount === 0) {
    return "noMatchingAttachments";
  }

  if (flattenWorkspaceSections) {
    return "showFlat";
  }

  return "showByWorkspace";
}

export function useAttachments({
  excludedExtensions,
  excludedDirectoryNames,
  workspaceSearchSignature,
  excludedExtensionsSignature,
  hasConfiguredRoots,
  searchText,
  selectedExtension,
  flattenWorkspaceSections,
}: Options): Result {
  const excludedExtensionsSet = useMemo(() => new Set(excludedExtensions), [excludedExtensionsSignature]);
  const excludedDirectoryNamesSet = useMemo(() => new Set(excludedDirectoryNames), [workspaceSearchSignature]);
  const [scanResult, setScanResult] = useState<AttachmentsSnapshot>(EMPTY_SCAN_RESULT);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    const loadAttachments = async () => {
      setIsLoading(true);

      try {
        if (!hasConfiguredRoots) {
          if (!canceled) {
            startTransition(() => {
              setScanResult(EMPTY_SCAN_RESULT);
            });
          }
          return;
        }

        const cached = await loadCachedAttachments(workspaceSearchSignature, excludedExtensionsSignature);

        if (cached && !canceled) {
          startTransition(() => {
            setScanResult(cached);
          });
        } else if (!canceled) {
          startTransition(() => {
            setScanResult(EMPTY_SCAN_RESULT);
          });
        }

        const refreshed = await scanAttachments({
          forceRefresh: true,
          excludedExtensions: excludedExtensionsSet,
          excludedDirectoryNames: excludedDirectoryNamesSet,
        });
        if (canceled) {
          return;
        }

        await saveCachedAttachments(refreshed, workspaceSearchSignature, excludedExtensionsSignature);

        if (!canceled) {
          startTransition(() => {
            setScanResult(refreshed);
          });
        }
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to scan attachments",
          message: error instanceof Error ? error.message : undefined,
        });
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void loadAttachments();

    return () => {
      canceled = true;
    };
  }, [
    excludedDirectoryNamesSet,
    excludedExtensionsSet,
    excludedExtensionsSignature,
    hasConfiguredRoots,
    workspaceSearchSignature,
  ]);

  useLoadingToast({
    isLoading,
    title: "Scanning attachments…",
  });

  const attachments = scanResult.attachments;
  const hasValidWorkspaces = scanResult.workspaceCount > 0;

  const filters = useMemo(() => {
    const uniqueExtensions = new Set<string>();
    for (const file of attachments) {
      if (file.extension) {
        uniqueExtensions.add(file.extension);
      }
    }

    return Array.from(uniqueExtensions).sort((left, right) => left.localeCompare(right));
  }, [attachments]);

  const visibleAttachments = useMemo(() => {
    if (selectedExtension === "all") {
      // Raycast built-in filtering handles search text only when the type filter is inactive
      return attachments;
    }

    return attachments
      .filter((file) => file.extension === selectedExtension)
      .filter((file) => matchesSearchIndex(file.searchText, searchText));
  }, [attachments, selectedExtension, searchText]);

  const sections = useMemo(() => {
    const grouped = new Map<string, AttachmentSection>();
    for (const file of visibleAttachments) {
      const existing = grouped.get(file.workspace.path);
      if (existing) {
        existing.files.push(file);
      } else {
        grouped.set(file.workspace.path, {
          workspacePath: file.workspace.path,
          workspaceName: file.workspace.name,
          files: [file],
        });
      }
    }

    return Array.from(grouped.values()).sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
  }, [visibleAttachments]);
  const searchState = getSearchState({
    isLoading,
    hasConfiguredRoots,
    hasValidWorkspaces,
    attachmentCount: attachments.length,
    visibleAttachmentCount: visibleAttachments.length,
    flattenWorkspaceSections,
  });

  return {
    attachments,
    visibleAttachments,
    sections,
    filters,
    searchState,
    isLoading,
  };
}
