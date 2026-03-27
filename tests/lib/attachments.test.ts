import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";
import { scanAttachments } from "../../src/lib/attachments";
import { loadWorkspaces } from "../../src/lib/workspaces";

vi.mock("../../src/lib/workspaces", () => ({
  loadWorkspaces: vi.fn(),
}));

const loadWorkspacesMock = vi.mocked(loadWorkspaces);

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("scanAttachments", () => {
  it("scans supported attachment directories and filters excluded files", async () => {
    tempDir = await createTempDir("octarine-attachments");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [workspace],
      invalidRoots: [],
      fromCache: false,
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
});
