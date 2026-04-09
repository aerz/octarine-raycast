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

type RenderState =
  | "loading"
  | "noConfiguredWorkspaces"
  | "noAvailableAttachments"
  | "noMatchingAttachments"
  | "showByWorkspace"
  | "showFlat";

type Options = {
  excludedExtensions: string[];
  excludedExtensionsSignature: string;
  searchText: string;
  selectedExtension: string;
  flattenWorkspaceSections: boolean;
};

type Result = {
  attachments: IndexedAttachment[];
  visibleAttachments: IndexedAttachment[];
  sections: AttachmentSection[];
  filters: string[];
  renderState: RenderState;
  isLoading: boolean;
};

type AttachmentResults = {
  filters: string[];
  visibleAttachments: IndexedAttachment[];
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

function getRenderState({
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
}): RenderState {
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

function buildAttachmentResults({
  attachments,
  selectedExtension,
  searchText,
}: {
  attachments: IndexedAttachment[];
  selectedExtension: string;
  searchText: string;
}): AttachmentResults {
  const filters = buildAttachmentFilters(attachments);
  const visibleAttachments = buildVisibleAttachments({
    attachments,
    selectedExtension,
    searchText,
  });

  return {
    filters,
    visibleAttachments,
    sections: buildAttachmentSections(visibleAttachments),
  };
}

function buildAttachmentFilters(attachments: IndexedAttachment[]): string[] {
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
  flattenWorkspaceSections,
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

  const attachments = scanResult.attachments;
  const hasValidWorkspaces = scanResult.workspaceCount > 0;
  const { filters, visibleAttachments, sections } = useMemo(
    () =>
      buildAttachmentResults({
        attachments,
        selectedExtension,
        searchText,
      }),
    [attachments, searchText, selectedExtension],
  );
  const renderState = getRenderState({
    isLoading,
    hasConfiguredRoots: preferences.hasConfiguredRoots,
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
    renderState,
    isLoading,
  };
}
