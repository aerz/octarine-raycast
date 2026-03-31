import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import {
  extensionPreferences,
  openTodayNotePreferences,
  searchAttachmentsPreferences,
  searchNotesPreferences,
} from "../../src/lib/preferences";

describe("preferences", () => {
  it("parses extension preferences into normalized values and signatures", () => {
    setMockPreferences({
      workspaceRoots: "~/Octarine, ./fixtures/workspaces, ~/Octarine",
      excludedWorkspaces: " Work , Personal ",
      excludedFoldersInWorkspaces: " Archive, Templates ",
      showWorkspaceNoteCount: true,
      showPinnedNotesFirst: false,
    });

    const preferences = extensionPreferences();

    expect(preferences.workspaceRoots).toEqual([
      path.normalize(path.join(os.homedir(), "Octarine")),
      path.normalize(path.resolve("./fixtures/workspaces")),
    ]);
    expect(preferences.excludedWorkspaces).toEqual(new Set(["work", "personal"]));
    expect(preferences.excludedFoldersInWorkspaces).toEqual(new Set(["archive", "templates"]));
    expect(preferences.hasConfiguredRoots).toBe(true);
    expect(preferences.workspaceDiscoverySignature).toContain("::personal|work");
    expect(preferences.workspaceSearchSignature).toContain("::archive|templates");
  });

  it("parses command-specific attachment preferences", () => {
    setMockPreferences({
      workspaceRoots: "~/Octarine",
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
      showWorkspaceAttachmentCount: true,
      flattenWorkspaceSections: false,
      excludeFileExtensions: ".PNG, pdf , txt",
    });

    const preferences = searchAttachmentsPreferences();

    expect(preferences.showWorkspaceAttachmentCount).toBe(true);
    expect(preferences.flattenWorkspaceSections).toBe(false);
    expect(preferences.excludedExtensions).toEqual(new Set(["png", "pdf", "txt"]));
    expect(preferences.excludedExtensionsSignature).toBe("pdf|png|txt");
  });

  it("returns trimmed command preferences and booleans", () => {
    setMockPreferences({
      workspaceRoots: "",
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
      defaultWorkspace: "  Work Notes  ",
      showWorkspaceNoteCount: true,
      showPinnedNotesFirst: true,
    });

    expect(openTodayNotePreferences()).toEqual({
      extension: expect.objectContaining({
        hasConfiguredRoots: false,
        workspaceRoots: [],
      }),
      defaultWorkspace: "Work Notes",
    });

    expect(searchNotesPreferences()).toEqual({
      extension: expect.objectContaining({
        hasConfiguredRoots: false,
      }),
      showWorkspaceNoteCount: true,
      showPinnedNotesFirst: true,
    });
  });
});
