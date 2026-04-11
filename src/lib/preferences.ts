import { getPreferenceValues } from "@raycast/api";
import { normalizeText, normalizeWorkspaceRoots, normalizeExtensions, splitLowerList } from "./utils";

export type ExtensionPreferences = {
  workspaceRoots: string[];
  excludedWorkspaces: Set<string>;
  excludedFoldersInWorkspaces: Set<string>;
  hasConfiguredRoots: boolean;
  workspaceDiscoverySignature: string;
  workspaceSearchSignature: string;
};

function buildSortedSignature(values: Iterable<string>): string {
  return Array.from(values).sort().join("|");
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

export function extensionPreferences(): ExtensionPreferences {
  const prefs = getPreferenceValues<Preferences>();
  const workspaceRoots = normalizeWorkspaceRoots(prefs.workspaceRoots);
  const excludedFoldersInWorkspaces = splitLowerList(prefs.excludedFoldersInWorkspaces);
  const excludedWorkspaces = splitLowerList(prefs.excludedWorkspaces);
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

export function searchNotesPreferences() {
  const preferences = getPreferenceValues<Preferences.SearchNotes>();

  return {
    showWorkspaceNoteCount: preferences.showWorkspaceNoteCount,
    showPinnedNotesFirst: preferences.showPinnedNotesFirst,
  };
}

export function searchAttachmentsPreferences() {
  const { showWorkspaceAttachmentCount, flattenWorkspaceSections, excludeFileExtensions } =
    getPreferenceValues<Preferences.SearchAttachments>();
  const excludedExtensions = normalizeExtensions(excludeFileExtensions);

  return {
    showWorkspaceAttachmentCount,
    flattenWorkspaceSections,
    excludedExtensions,
  };
}

export function openTodayNotePreferences() {
  const preferences = getPreferenceValues<Preferences.OpenTodayNote>();

  return {
    defaultWorkspace: normalizeText(preferences.defaultWorkspace),
  };
}

export function searchViewsPreferences() {
  const { showWorkspaceViewCount } = getPreferenceValues<Preferences.SearchViews>();

  return {
    showWorkspaceViewCount,
  };
}

export function searchPinnedNotesPreferences() {
  const preferences = getPreferenceValues<Preferences.SearchPinnedNotes>();

  return {
    showWorkspaceNoteCount: preferences.showWorkspaceNoteCount,
  };
}
