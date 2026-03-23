import { getPreferenceValues } from "@raycast/api";
import os from "node:os";
import path from "node:path";

export type ExtensionPreferences = {
  workspaceRoots: string[];
  excludedWorkspaces: Set<string>;
  excludedFoldersInWorkspaces: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceDiscoverySignature: string;
  workspaceSearchSignature: string;
};

export type SearchNotesPreferences = {
  extension: ExtensionPreferences;
  showWorkspaceNoteCount: boolean;
  showPinnedNotesFirst: boolean;
};

export type SearchPinnedNotesPreferences = {
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
  workspace: string;
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

export function parseExcludedNames(rawValue?: string): Set<string> {
  return new Set(parseCommaSeparatedValues(rawValue).map((value) => value.toLowerCase()));
}

export function parseExcludedFileExtensions(rawValue?: string): Set<string> {
  return new Set(parseCommaSeparatedValues(rawValue).map((extension) => extension.toLowerCase().replace(/^\./, "")));
}

export function buildWorkspaceDiscoverySignature(workspaceRoots: string[], excludedWorkspaces: Set<string>): string {
  const rootsSignature = buildSortedSignature(workspaceRoots);
  const excludedWorkspacesSignature = buildSortedSignature(excludedWorkspaces);
  return `${rootsSignature}::${excludedWorkspacesSignature}`;
}

export function buildWorkspaceSearchSignature(
  workspaceDiscoverySignature: string,
  excludedFoldersInWorkspaces: Set<string>,
): string {
  return `${workspaceDiscoverySignature}::${buildSortedSignature(excludedFoldersInWorkspaces)}`;
}

function buildExtensionPreferences(preferences: Preferences): ExtensionPreferences {
  const workspaceRoots = parseWorkspaceRoots(preferences.workspaceRoots);
  const excludedWorkspaces = parseExcludedNames(preferences.excludedWorkspaces);
  const excludedFoldersInWorkspaces = parseExcludedNames(preferences.excludedFoldersInWorkspaces);
  const workspaceDiscoverySignature = buildWorkspaceDiscoverySignature(workspaceRoots, excludedWorkspaces);

  return {
    workspaceRoots,
    excludedWorkspaces,
    excludedFoldersInWorkspaces,
    hasConfiguredRoots: workspaceRoots.length > 0,
    workspaceDiscoverySignature,
    workspaceSearchSignature: buildWorkspaceSearchSignature(workspaceDiscoverySignature, excludedFoldersInWorkspaces),
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
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  };
}

export function getSearchPinnedNotesPreferences(): SearchPinnedNotesPreferences {
  const preferences = getPreferenceValues<Preferences.SearchPinnedNotes>();

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
    workspace: normalizeOptionalString(preferences.workspace),
  };
}
