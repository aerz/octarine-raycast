import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeDir, writeTextFile } from "../../tests/helpers/fs";
import { refreshPinnedNotesCache, scanWorkspaceForNotes } from "./notes";

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

    const notes = await scanWorkspaceForNotes(workspace, new Set(["archive"]), async () => undefined);
    const notesByPath = notes.slice().sort((left, right) => left.path.localeCompare(right.path));

    expect(notesByPath).toHaveLength(2);
    expect(notesByPath).toEqual([
      expect.objectContaining({
        id: "Work::docs/Guide.md",
        title: "Guide",
        path: "docs/Guide.md",
        normalizedDirectory: "docs",
        directorySegments: ["docs"],
        searchText: "guide docs/guide.md work",
      }),
      expect.objectContaining({
        id: "Work::root.md",
        title: "root",
        path: "root.md",
        normalizedDirectory: "",
        directorySegments: [],
        searchText: "root root.md work",
      }),
    ]);
  });

  it("detects pinned notes and reuses cached file metadata", async () => {
    tempDir = await createTempDir("octarine-pinned-notes");

    const workspace = {
      name: "Work",
      path: path.join(tempDir, "Work"),
    };

    await writeTextFile(path.join(workspace.path, "Pinned.md"), "---\npinned: true\n---\ncontent");
    await writeTextFile(path.join(workspace.path, "Regular.md"), "---\npinned: false\n---\ncontent");

    const readFileSpy = vi.spyOn(fs, "readFile");

    const firstResult = await refreshPinnedNotesCache([workspace], new Set(), "signature", async () => undefined);

    expect(firstResult.map((note) => note.path)).toEqual(["Pinned.md"]);
    expect(readFileSpy).toHaveBeenCalledTimes(2);

    readFileSpy.mockClear();

    const secondResult = await refreshPinnedNotesCache([workspace], new Set(), "signature", async () => undefined);

    expect(secondResult.map((note) => note.path)).toEqual(["Pinned.md"]);
    expect(readFileSpy).not.toHaveBeenCalled();
  });
});
