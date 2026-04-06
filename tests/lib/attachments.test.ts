import { LocalStorage } from "@raycast/api";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadCachedAttachments,
  saveCachedAttachments,
  scanAttachments,
  type AttachmentsSnapshot,
} from "../../src/lib/attachments";
import { loadWorkspaces } from "../../src/lib/workspaces";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";

vi.mock("../../src/lib/workspaces", () => ({
  loadWorkspaces: vi.fn(),
}));

const ATTACHMENTS_CACHE_KEY = "octarine.attachments.v1";
const loadWorkspacesMock = vi.mocked(loadWorkspaces);

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  loadWorkspacesMock.mockReset();
  await LocalStorage.clear();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("attachments", () => {
  it("scans supported attachment directories and filters excluded files", async () => {
    tempDir = await createTempDir("octarine-attachments");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [workspace],
      invalidRoots: [],
    });

    await writeTextFile(path.join(workspace.path, ".attachments", "docs", "report.pdf"), "report");
    await writeTextFile(path.join(workspace.path, ".attachments", "images", "logo.png"), "png");
    await writeTextFile(path.join(workspace.path, ".files", "notes", "readme.md"), "readme");
    await writeTextFile(path.join(workspace.path, ".files", "~$draft.docx"), "temp");
    await writeTextFile(path.join(workspace.path, ".files", ".DS_Store"), "system");
    await writeTextFile(path.join(workspace.path, ".files", "Archive", "ignored.txt"), "ignored");

    const result = await scanAttachments({
      excludedExtensions: new Set(["png"]),
      excludedDirectoryNames: new Set(["archive"]),
    });

    expect(result.workspaceCount).toBe(1);
    expect(result.attachments.map((attachment) => attachment.name)).toEqual(["readme.md", "report.pdf"]);
    expect(result.attachments.map((attachment) => attachment.searchText)).toEqual([
      "readme.md work md",
      "report.pdf work pdf",
    ]);
  });

  it("loads cached attachments when both signatures match", async () => {
    const cached = buildCachedResult();

    await saveCachedAttachments(cached, "workspace-signature", "extensions-signature");

    expect(await loadCachedAttachments("workspace-signature", "extensions-signature")).toEqual(cached);
  });

  it("ignores cached attachments when the excluded extensions signature changes", async () => {
    const cached = buildCachedResult();

    await saveCachedAttachments(cached, "workspace-signature", "extensions-a");

    expect(await loadCachedAttachments("workspace-signature", "extensions-b")).toBeUndefined();
  });

  it("ignores cached attachments when the workspace signature changes", async () => {
    const cached = buildCachedResult();

    await saveCachedAttachments(cached, "workspace-a", "extensions-signature");

    expect(await loadCachedAttachments("workspace-b", "extensions-signature")).toBeUndefined();
  });

  it("ignores invalid cached payloads", async () => {
    await LocalStorage.setItem(
      ATTACHMENTS_CACHE_KEY,
      JSON.stringify({
        version: 1,
        workspaceSearchSignature: "workspace-signature",
        excludedExtensionsSignature: "extensions-signature",
        workspaceCount: 1,
        attachments: [{ name: "report.pdf", path: "/tmp/work/.attachments/report.pdf", extension: "pdf" }],
      }),
    );

    expect(await loadCachedAttachments("workspace-signature", "extensions-signature")).toBeUndefined();
  });

  it("ignores cached attachments with the wrong cache version", async () => {
    await LocalStorage.setItem(
      ATTACHMENTS_CACHE_KEY,
      JSON.stringify({
        version: 99,
        workspaceSearchSignature: "workspace-signature",
        excludedExtensionsSignature: "extensions-signature",
        workspaceCount: 0,
        attachments: [],
      }),
    );

    expect(await loadCachedAttachments("workspace-signature", "extensions-signature")).toBeUndefined();
  });

  it("picks up on-disk changes after a forced refresh and updates the stored cache", async () => {
    tempDir = await createTempDir("octarine-attachments-refresh");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [workspace],
      invalidRoots: [],
    });

    await writeTextFile(path.join(workspace.path, ".attachments", "Inbox.pdf"), "initial");

    const initial = await scanAttachments();
    await saveCachedAttachments(initial, "workspace-signature", "extensions-signature");

    await writeTextFile(path.join(workspace.path, ".attachments", "Archive.pdf"), "updated");

    const cachedBeforeRefresh = await loadCachedAttachments("workspace-signature", "extensions-signature");
    const refreshed = await scanAttachments({ forceRefresh: true });
    await saveCachedAttachments(refreshed, "workspace-signature", "extensions-signature");

    expect(initial.attachments.map((attachment) => attachment.name)).toEqual(["Inbox.pdf"]);
    expect(cachedBeforeRefresh?.attachments.map((attachment) => attachment.name)).toEqual(["Inbox.pdf"]);
    expect(refreshed.attachments.map((attachment) => attachment.name)).toEqual(["Archive.pdf", "Inbox.pdf"]);
    expect(await loadCachedAttachments("workspace-signature", "extensions-signature")).toEqual({
      workspaceCount: 1,
      attachments: refreshed.attachments,
    });
    expect(loadWorkspacesMock).toHaveBeenNthCalledWith(1, { refresh: undefined });
    expect(loadWorkspacesMock).toHaveBeenNthCalledWith(2, { refresh: true });
  });
});

function buildCachedResult(): AttachmentsSnapshot {
  const workspace = { name: "Work", path: "/tmp/work" };

  return {
    workspaceCount: 1,
    attachments: [
      {
        name: "report.pdf",
        path: "/tmp/work/.attachments/report.pdf",
        extension: "pdf",
        workspace,
        searchText: "report.pdf work pdf",
      },
    ],
  };
}
