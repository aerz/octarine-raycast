import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";
import { getPinnedNotes, scanNotes } from "../../src/lib/notes";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("notes", () => {
  it("scans markdown files and builds indexed note fields", async () => {
    tempDir = await createTempDir("octarine-notes");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    await writeTextFile(path.join(workspace.path, "root.md"), "# Root");
    await writeTextFile(path.join(workspace.path, "docs", "Guide.md"), "# Guide");
    await writeTextFile(path.join(workspace.path, ".octarine", "hidden.md"), "# Hidden");
    await writeTextFile(path.join(workspace.path, ".templates", "template.md"), "# Template");
    await writeTextFile(path.join(workspace.path, "Archive", "ignored.md"), "# Ignored");
    await writeTextFile(path.join(workspace.path, "docs", "image.png"), "png");

    const notes = await scanNotes([workspace], new Set(["archive"]));
    const notesByPath = notes.slice().sort((a, b) => a.path.localeCompare(b.path));

    expect(notesByPath).toHaveLength(2);
    expect(notesByPath).toEqual([
      expect.objectContaining({
        id: "Work::docs/Guide.md",
        title: "Guide",
        path: "docs/Guide.md",
        searchText: "guide docs/guide.md work",
        folder: expect.objectContaining({
          name: "docs",
          path: "docs",
          workspace,
        }),
      }),
      expect.objectContaining({
        id: "Work::root.md",
        title: "root",
        path: "root.md",
        searchText: "root root.md work",
        folder: expect.objectContaining({
          name: "",
          path: "",
          workspace,
        }),
      }),
    ]);
  });

  it("loads only pinned notes and reuses the pinned notes cache", async () => {
    tempDir = await createTempDir("octarine-pinned-notes");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    await writeTextFile(path.join(workspace.path, "Pinned.md"), "---\npinned: true\n---\ncontent");
    await writeTextFile(path.join(workspace.path, "Regular.md"), "---\npinned: false\n---\ncontent");

    const firstResult = await getPinnedNotes([workspace], new Set());

    expect(firstResult.map((note) => note.path)).toEqual(["Pinned.md"]);
    await writeTextFile(path.join(workspace.path, "Regular.md"), "---\npinned: true\n---\ncontent");

    const secondResult = await getPinnedNotes([workspace], new Set());

    expect(secondResult.map((note) => note.path)).toEqual(["Pinned.md"]);
  });

  it("rescans pinned notes when refresh is requested", async () => {
    tempDir = await createTempDir("octarine-pinned-notes-refresh");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    await writeTextFile(path.join(workspace.path, "Pinned.md"), "---\npinned: true\n---\ncontent");
    await writeTextFile(path.join(workspace.path, "Regular.md"), "---\npinned: false\n---\ncontent");

    expect((await getPinnedNotes([workspace], new Set())).map((note) => note.path)).toEqual(["Pinned.md"]);

    await writeTextFile(path.join(workspace.path, "Regular.md"), "---\npinned: true\n---\ncontent");

    const refreshed = await getPinnedNotes([workspace], new Set(), { refresh: true });

    expect(refreshed.map((note) => note.path)).toEqual(["Pinned.md", "Regular.md"]);
  });

  it("rescans when excluded directories change", async () => {
    tempDir = await createTempDir("octarine-pinned-notes-excluded-dirs");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    await writeTextFile(path.join(workspace.path, "Pinned.md"), "---\npinned: true\n---\ncontent");
    await writeTextFile(path.join(workspace.path, "Archive", "Hidden.md"), "---\npinned: true\n---\ncontent");

    expect((await getPinnedNotes([workspace], new Set(["archive"]))).map((note) => note.path)).toEqual(["Pinned.md"]);

    const rescanned = await getPinnedNotes([workspace], new Set());

    expect(rescanned.map((note) => note.path)).toEqual(["Archive/Hidden.md", "Pinned.md"]);
  });

  it("rescans when the workspace set changes", async () => {
    tempDir = await createTempDir("octarine-pinned-notes-workspace-change");

    const work = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };
    const personal = {
      name: "Personal",
      path: path.join(tempDir, "Personal"),
    };

    await writeTextFile(path.join(work.path, "Pinned.md"), "---\npinned: true\n---\ncontent");
    await writeTextFile(path.join(personal.path, "Side.md"), "---\npinned: true\n---\ncontent");

    expect((await getPinnedNotes([work], new Set())).map((note) => note.id)).toEqual(["Work::Pinned.md"]);

    const rescanned = await getPinnedNotes([work, personal], new Set());

    expect(rescanned.map((note) => note.id)).toEqual(["Personal::Side.md", "Work::Pinned.md"]);
  });

  it("fails when note scanning hits an unreadable workspace", async () => {
    tempDir = await createTempDir("octarine-notes-scan-error");

    const missing = {
      name: "Missing",
      path: path.join(tempDir, "Missing"),
    };
    const laterMissing = {
      name: "LaterMissing",
      path: path.join(tempDir, "LaterMissing"),
    };

    await expect(scanNotes([missing, laterMissing], new Set())).rejects.toThrow(/Failed to read directory .+/);
  });
});
