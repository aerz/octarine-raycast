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
  flattenWorkspaceSections: boolean;
  excludedExtensions: Set<string>;
  excludedExtensionsSignature: string;
};

export type SearchViewsPreferences = {
  extension: ExtensionPreferences;
  showWorkspaceViewCount: boolean;
};

export type OpenTodayNotePreferences = {
  extension: ExtensionPreferences;
  defaultWorkspace: string;
};

function normalizeOptionalString(value?: string): string {
  return value?.trim() ?? "";
}

function parseCommaSeparated(str?: string): string[] {
  if (!str) {
    return [];
  }

  return str
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

function parseWorkspaceRoots(textfield: string): string[] {
  const result = new Set<string>();

  for (const root of parseCommaSeparated(textfield)) {
    const expanded = expandTilde(root);
    const absolute = path.resolve(expanded);
    result.add(path.normalize(absolute));
  }

  return Array.from(result);
}

function parseExcludedNames(textfield?: string): Set<string> {
  return new Set(parseCommaSeparated(textfield).map((value) => value.toLowerCase()));
}

function buildWorkspaceDiscoverySignature(workspaceRoots: string[], excludedWorkspaces: Set<string>): string {
  const rootsSignature = buildSortedSignature(workspaceRoots);
  const excludedWorkspacesSignature = buildSortedSignature(excludedWorkspaces);
  return `${rootsSignature}::${excludedWorkspacesSignature}`;
}

function buildWorkspaceSearchSignature(
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

export function extensionPreferences(): ExtensionPreferences {
  return buildExtensionPreferences(getPreferenceValues<Preferences>());
}

export function searchNotesPreferences(): SearchNotesPreferences {
  const preferences = getPreferenceValues<Preferences.SearchNotes>();

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceNoteCount: preferences.showWorkspaceNoteCount,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  };
}

export function searchPinnedNotesPreferences(): SearchPinnedNotesPreferences {
  const preferences = getPreferenceValues<Preferences.SearchPinnedNotes>();

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceNoteCount: preferences.showWorkspaceNoteCount,
  };
}

export function searchAttachmentsPreferences(): SearchAttachmentsPreferences {
  const preferences = getPreferenceValues<Preferences.SearchAttachments>();
  const excludedExtensions = new Set(
    parseCommaSeparated(preferences.excludeFileExtensions).map((extension) =>
      extension.toLowerCase().replace(/^\./, ""),
    ),
  );

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceAttachmentCount: preferences.showWorkspaceAttachmentCount,
    flattenWorkspaceSections: preferences.flattenWorkspaceSections,
    excludedExtensions,
    excludedExtensionsSignature: buildSortedSignature(excludedExtensions),
  };
}

export function searchViewsPreferences(): SearchViewsPreferences {
  const preferences = getPreferenceValues<Preferences.SearchViews>();

  return {
    extension: buildExtensionPreferences(preferences),
    showWorkspaceViewCount: preferences.showWorkspaceViewCount,
  };
}

export function openTodayNotePreferences(): OpenTodayNotePreferences {
  const preferences = getPreferenceValues<Preferences.OpenTodayNote>();

  return {
    extension: buildExtensionPreferences(preferences),
    defaultWorkspace: normalizeOptionalString(preferences.defaultWorkspace),
  };
}
