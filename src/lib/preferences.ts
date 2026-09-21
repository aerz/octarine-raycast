import { getPreferenceValues } from "@raycast/api";
import { normalizeText, normalizeWorkspaceRoots, normalizeExtensions, splitLowerList } from "./utils";

export type ExtensionPreferences = {
  workspaceRoots: string[];
  excludedWorkspaces: Set<string>;
  excludedFoldersInWorkspaces: Set<string>;
};

export function extensionPreferences(): ExtensionPreferences {
  const prefs = getPreferenceValues<Preferences>();
  const workspaceRoots = normalizeWorkspaceRoots(prefs.workspaceRoots);
  const excludedFoldersInWorkspaces = splitLowerList(prefs.excludedFoldersInWorkspaces);
  const excludedWorkspaces = splitLowerList(prefs.excludedWorkspaces);

  return {
    workspaceRoots,
    excludedWorkspaces,
    excludedFoldersInWorkspaces,
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

export function openDailyDeskNotePreferences() {
  const preferences = getPreferenceValues<Preferences.OpenDailyDeskNote>();

  return {
    defaultWorkspace: normalizeText(preferences.defaultWorkspace),
    showFilename: Boolean(preferences.showFilename),
    useLastWorkspace: preferences.useLastWorkspace !== false,
  };
}
