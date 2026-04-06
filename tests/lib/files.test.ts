import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readMarkdownFrontmatter, scanMarkdownFiles } from "../../src/lib/files";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("files", () => {
  it("scans markdown files recursively and returns posix relative paths", async () => {
    tempDir = await createTempDir("octarine-files");

    const rootPath = path.join(tempDir, "Workspace");

    await writeTextFile(path.join(rootPath, "root.md"), "# Root");
    await writeTextFile(path.join(rootPath, "docs", "Guide.md"), "# Guide");
    await writeTextFile(path.join(rootPath, "docs", "nested", "Deep.md"), "# Deep");
    await writeTextFile(path.join(rootPath, "docs", "image.png"), "png");

    const files = await scanMarkdownFiles(rootPath, new Set());

    expect(files.map((file) => file.relative).sort((left, right) => left.localeCompare(right))).toEqual([
      "docs/Guide.md",
      "docs/nested/Deep.md",
      "root.md",
    ]);
  });

  it("skips excluded directories", async () => {
    tempDir = await createTempDir("octarine-files-excluded");

    const rootPath = path.join(tempDir, "Workspace");

    await writeTextFile(path.join(rootPath, "root.md"), "# Root");
    await writeTextFile(path.join(rootPath, "Archive", "Hidden.md"), "# Hidden");

    const files = await scanMarkdownFiles(rootPath, new Set(["archive"]));

    expect(files.map((file) => file.relative)).toEqual(["root.md"]);
  });

  it("reads only the frontmatter block", async () => {
    tempDir = await createTempDir("octarine-files-frontmatter");

    const filePath = path.join(tempDir, "Note.md");
    await writeTextFile(filePath, "---\npinned: true\n---\ncontent");

    await expect(readMarkdownFrontmatter(filePath)).resolves.toBe("---\npinned: true\n---");
  });

  it("stops immediately when the file does not start with frontmatter", async () => {
    tempDir = await createTempDir("octarine-files-no-frontmatter");

    const filePath = path.join(tempDir, "Note.md");
    await writeTextFile(filePath, "# Note\n---\npinned: true\n---\ncontent");

    await expect(readMarkdownFrontmatter(filePath)).resolves.toBeUndefined();
  });

  it("throws a path-based error when a directory cannot be read", async () => {
    tempDir = await createTempDir("octarine-files-error");

    const rootPath = path.join(tempDir, "Workspace");
    await writeTextFile(path.join(rootPath, "root.md"), "# Root");

    const readdir = fs.readdir.bind(fs);
    vi.spyOn(fs, "readdir").mockImplementation((target, options) => {
      if (target === rootPath) {
        return Promise.reject(new Error("EACCES"));
      }

      return readdir(target, options as never);
    });

    await expect(scanMarkdownFiles(rootPath, new Set())).rejects.toThrow(`Failed to read directory ${rootPath}`);
  });
});
