import { Toast, showToast } from "@raycast/api";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  type AttachmentsSnapshot,
  loadCachedAttachments,
  saveCachedAttachments,
  scanAttachments,
} from "../lib/attachments";
import { extensionPreferences } from "../lib/preferences";
import { querySearchText } from "../lib/search";
import type { IndexedAttachment } from "../types/attachments";
import { useLoadingToast } from "./useLoadingToast";

export type AttachmentSection = {
  workspacePath: string;
  workspaceName: string;
  files: IndexedAttachment[];
};

type Options = {
  excludedExtensions: string[];
  excludedExtensionsSignature: string;
  searchText: string;
  selectedExtension: string;
};

type Result = {
  dropdown: string[];
  sections: AttachmentSection[];
  isLoading: boolean;
};

type AttachmentResults = {
  dropdown: string[];
  sections: AttachmentSection[];
};

const EMPTY_SCAN_RESULT: AttachmentsSnapshot = {
  attachments: [],
  workspaceCount: 0,
};

function useAttachmentsSource({
  hasConfiguredRoots,
  workspaceSearchSignature,
  excludedExtensionsSignature,
  excludedExtensionsSet,
  excludedDirectoryNamesSet,
}: {
  hasConfiguredRoots: boolean;
  workspaceSearchSignature: string;
  excludedExtensionsSignature: string;
  excludedExtensionsSet: Set<string>;
  excludedDirectoryNamesSet: Set<string>;
}): {
  scanResult: AttachmentsSnapshot;
  isLoading: boolean;
  loadError: Error | undefined;
} {
  const [scanResult, setScanResult] = useState<AttachmentsSnapshot>(EMPTY_SCAN_RESULT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let canceled = false;

    const applyScanResult = (nextScanResult: AttachmentsSnapshot) => {
      if (canceled) {
        return;
      }

      startTransition(() => {
        setScanResult(nextScanResult);
      });
    };

    const loadAttachments = async () => {
      setIsLoading(true);
      setLoadError(undefined);

      try {
        if (!hasConfiguredRoots) {
          applyScanResult(EMPTY_SCAN_RESULT);
          return;
        }

        const cached = await loadCachedAttachments(workspaceSearchSignature, excludedExtensionsSignature);
        applyScanResult(cached ?? EMPTY_SCAN_RESULT);

        const refreshed = await scanAttachments({
          forceRefresh: true,
          excludedExtensions: excludedExtensionsSet,
          excludedDirectoryNames: excludedDirectoryNamesSet,
        });
        if (canceled) {
          return;
        }

        await saveCachedAttachments(refreshed, workspaceSearchSignature, excludedExtensionsSignature);
        applyScanResult(refreshed);
      } catch (error) {
        if (!canceled) {
          setLoadError(toError(error));
        }
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

  return {
    scanResult,
    isLoading,
    loadError,
  };
}

function useAttachmentsEffects({ isLoading, loadError }: { isLoading: boolean; loadError: Error | undefined }): void {
  useLoadingToast({
    isLoading,
    title: "Scanning attachments…",
  });

  useEffect(() => {
    if (!loadError) {
      return;
    }

    void showToast({
      style: Toast.Style.Failure,
      title: "Failed to scan attachments",
      message: loadError.message,
    });
  }, [loadError]);
}

function buildAttachmentResults({
  attachments,
  selectedExtension,
  searchText,
}: {
  attachments: IndexedAttachment[];
  selectedExtension: string;
  searchText: string;
}): AttachmentResults {
  const dropdown = buildAttachmentDropdown(attachments);
  const visibleAttachments = buildVisibleAttachments({
    attachments,
    selectedExtension,
    searchText,
  });

  return {
    dropdown,
    sections: buildAttachmentSections(visibleAttachments),
  };
}

function buildAttachmentDropdown(attachments: IndexedAttachment[]): string[] {
  const uniqueExtensions = new Set<string>();

  for (const file of attachments) {
    if (file.extension) {
      uniqueExtensions.add(file.extension);
    }
  }

  return Array.from(uniqueExtensions).sort((a, b) => a.localeCompare(b));
}

function buildVisibleAttachments({
  attachments,
  selectedExtension,
  searchText,
}: {
  attachments: IndexedAttachment[];
  selectedExtension: string;
  searchText: string;
}): IndexedAttachment[] {
  if (selectedExtension === "all") {
    // Raycast built-in filtering handles search text only when the type filter is inactive
    return attachments;
  }

  return attachments
    .filter((file) => file.extension === selectedExtension)
    .filter((file) => querySearchText(file, searchText));
}

function buildAttachmentSections(visibleAttachments: IndexedAttachment[]): AttachmentSection[] {
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

  return Array.from(grouped.values()).sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useAttachments({
  excludedExtensions,
  excludedExtensionsSignature,
  searchText,
  selectedExtension,
}: Options): Result {
  const preferences = extensionPreferences();

  const excludedDirectoryNames = useMemo(
    () => Array.from(preferences.excludedFoldersInWorkspaces).sort((a, b) => a.localeCompare(b)),
    [preferences.workspaceSearchSignature],
  );

  const excludedExtensionsSet = useMemo(() => new Set(excludedExtensions), [excludedExtensionsSignature]);

  const excludedDirectoryNamesSet = useMemo(
    () => new Set(excludedDirectoryNames),
    [preferences.workspaceSearchSignature],
  );

  const { scanResult, isLoading, loadError } = useAttachmentsSource({
    hasConfiguredRoots: preferences.hasConfiguredRoots,
    workspaceSearchSignature: preferences.workspaceSearchSignature,
    excludedExtensionsSignature,
    excludedExtensionsSet,
    excludedDirectoryNamesSet,
  });

  useAttachmentsEffects({ isLoading, loadError });

  const { dropdown, sections } = useMemo(
    () =>
      buildAttachmentResults({
        attachments: scanResult.attachments,
        selectedExtension,
        searchText,
      }),
    [scanResult.attachments, searchText, selectedExtension],
  );

  return {
    dropdown,
    sections,
    isLoading,
  };
}
