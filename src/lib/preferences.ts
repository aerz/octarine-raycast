import { getPreferenceValues } from "@raycast/api";
import os from "node:os";
import path from "node:path";

export type ExtensionPreferences = {
  workspaceRoots: string[];
  excludedFolders: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceDiscoverySignature: string;
};

export type SearchNotesPreferences = {
  extension: ExtensionPreferences;
  showWorkspaceNoteCount: boolean;
};

export type SearchAttachmentsPreferences = {
  extension: ExtensionPreferences;
  showWorkspaceAttachmentCount: boolean;
  hideWorkspaceSections: boolean;
  excludeFileExtensions: Set<string>;
  excludeFileExtensionsSignature: string;
};

export type SearchViewsPreferences = {
  extension: ExtensionPreferences;
  showWorkspaceViewCount: boolean;
};

export type OpenTodayNotePreferences = {
  extension: ExtensionPreferences;
  workspaceName: string;
};

function normalizeOptionalString(value?: string): string {
  return value?.trim() ?? "";
}

function parseCommaSeparatedValues(rawValue?: string): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir();
  }

  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function buildSortedSignature(values: Iterable<string>): string {
  return Array.from(values).sort().join("|");
}

export function parseWorkspaceRoots(rawValue: string): string[] {
  const dedupedRoots = new Set<string>();

  for (const root of parseCommaSeparatedValues(rawValue)) {
    const expanded = expandTilde(root);
    const absolute = path.resolve(expanded);
    dedupedRoots.add(path.normalize(absolute));
  }

  return Array.from(dedupedRoots);
}

export function parseExcludedFolders(rawValue?: string): Set<string> {
  return new Set(parseCommaSeparatedValues(rawValue).map((folder) => folder.toLowerCase()));
}

export function parseExcludedFileExtensions(rawValue?: string): Set<string> {
  return new Set(parseCommaSeparatedValues(rawValue).map((extension) => extension.toLowerCase().replace(/^\./, "")));
}

export function buildWorkspaceDiscoverySignature(workspaceRoots: string[], excludedFolders: Set<string>): string {
  const rootsSignature = buildSortedSignature(workspaceRoots);
  const excludedFoldersSignature = buildSortedSignature(excludedFolders);
  return `${rootsSignature}::${excludedFoldersSignature}`;
}

function buildExtensionPreferences(preferences: Preferences): ExtensionPreferences {
  const workspaceRoots = parseWorkspaceRoots(preferences.workspaceRoots);
  const excludedFolders = parseExcludedFolders(preferences.excludedFolders);

  return {
    workspaceRoots,
    excludedFolders,
    hasConfiguredRoots: workspaceRoots.length > 0,
    workspaceDiscoverySignature: buildWorkspaceDiscoverySignature(workspaceRoots, excludedFolders),
  };
}

export function getExtensionPreferences(): ExtensionPreferences {
  return buildExtensionPreferences(getPreferenceValues<Preferences>());
}

export function getSearchNotesPreferences(): SearchNotesPreferences {
  const preferences = getPreferenceValues<Preferences.SearchNotes>();

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceNoteCount: preferences.showWorkspaceNoteCount,
  };
}

export function getSearchAttachmentsPreferences(): SearchAttachmentsPreferences {
  const preferences = getPreferenceValues<Preferences.SearchAttachments>();
  const excludeFileExtensions = parseExcludedFileExtensions(preferences.excludeFileExtensions);

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceAttachmentCount: preferences.showWorkspaceAttachmentCount,
    hideWorkspaceSections: preferences.hideWorkspaceSections,
    excludeFileExtensions,
    excludeFileExtensionsSignature: buildSortedSignature(excludeFileExtensions),
  };
}

export function getSearchViewsPreferences(): SearchViewsPreferences {
  const preferences = getPreferenceValues<Preferences.SearchViews>();

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceViewCount: preferences.showWorkspaceViewCount,
  };
}

export function getOpenTodayNotePreferences(): OpenTodayNotePreferences {
  const preferences = getPreferenceValues<Preferences.OpenTodayNote>();

  return {
    extension: buildExtensionPreferences(preferences),
    workspaceName: normalizeOptionalString(preferences.workspaceName),
  };
}
