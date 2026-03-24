import { Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { type AttachmentScanResult, scanAttachments } from "../lib/attachments";
import { matchesSearchIndex } from "../lib/search";
import { isIndexedAttachment, type IndexedAttachment } from "../types/attachment";
import { useLoadingToast } from "./useLoadingToast";

export type AttachmentSection = {
  workspacePath: string;
  workspaceName: string;
  files: IndexedAttachment[];
};

type Options = {
  excludedExtensions: Set<string>;
  excludedDirectoryNames: Set<string>;
  workspaceSearchSignature: string;
  excludedExtensionsSignature: string;
  searchText: string;
  fileExtensionFilter: string;
};

type Result = {
  attachments: IndexedAttachment[];
  visibleAttachments: IndexedAttachment[];
  sections: AttachmentSection[];
  filters: string[];
  isLoading: boolean;
  hasValidWorkspaces: boolean;
};

export function useAttachments({
  excludedExtensions,
  excludedDirectoryNames,
  workspaceSearchSignature,
  excludedExtensionsSignature,
  searchText,
  fileExtensionFilter,
}: Options): Result {
  const { data: scanResult, isLoading } = useCachedPromise(
    async (workspaceSearchSignature: string, excludedExtensionsSignature: string): Promise<AttachmentScanResult> => {
      void workspaceSearchSignature;
      void excludedExtensionsSignature;
      return scanAttachments({
        excludedExtensions,
        excludedDirectoryNames,
      });
    },
    [workspaceSearchSignature, excludedExtensionsSignature],
    {
      initialData: { attachments: [], workspaceCount: 0 } satisfies AttachmentScanResult,
      onError: async (error) => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to scan attachments",
          message: error.message,
        });
      },
    },
  );
  useLoadingToast({
    isLoading,
    title: "Scanning attachments…",
  });

  const attachments = useMemo(
    () => (scanResult?.attachments ?? []).filter((file): file is IndexedAttachment => isIndexedAttachment(file)),
    [scanResult],
  );
  const hasValidWorkspaces = (scanResult?.workspaceCount ?? 0) > 0;

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
    if (fileExtensionFilter === "all") {
      // Raycast built-in filtering handles search text only when the type filter is inactive
      return attachments;
    }

    return attachments
      .filter((file) => file.extension === fileExtensionFilter)
      .filter((file) => matchesSearchIndex(file.searchText, searchText));
  }, [attachments, fileExtensionFilter, searchText]);

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

  return {
    attachments,
    visibleAttachments,
    sections,
    filters,
    isLoading,
    hasValidWorkspaces,
  };
}
