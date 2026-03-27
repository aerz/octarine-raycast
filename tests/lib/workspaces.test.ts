import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDir, ensureDir, removeDir } from "../helpers/fs";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import { loadWorkspaces } from "../../src/lib/workspaces";

const workspaceMarker = ".octarine";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("loadWorkspaces", () => {
  it("discovers workspaces, skips exclusions, dedupes overlaps, and reports invalid roots", async () => {
    tempDir = await createTempDir("octarine-workspaces");

    const root = path.join(tempDir, "root");
    const nestedRoot = path.join(root, "nested");
    const invalidRoot = path.join(tempDir, "missing");

    await ensureDir(path.join(root, "Alpha", workspaceMarker));
    await ensureDir(path.join(nestedRoot, "Beta", workspaceMarker));
    await ensureDir(path.join(root, "SkipMe", workspaceMarker));

    setMockPreferences({
      workspaceRoots: `${root}, ${nestedRoot}, ${invalidRoot}`,
      excludedWorkspaces: "skipme",
      excludedFoldersInWorkspaces: "",
    });

    const result = await loadWorkspaces();

    expect(result.fromCache).toBe(false);
    expect(result.invalidRoots).toEqual([invalidRoot]);
    expect(result.workspaces).toEqual([
      { name: "Alpha", path: path.join(root, "Alpha") },
      { name: "Beta", path: path.join(nestedRoot, "Beta") },
    ]);
  });

  it("reuses the cache until a refresh is requested", async () => {
    tempDir = await createTempDir("octarine-workspaces-cache");

    const root = path.join(tempDir, "root");
    await ensureDir(path.join(root, "Alpha", workspaceMarker));

    setMockPreferences({
      workspaceRoots: root,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });

    const initial = await loadWorkspaces();

    await ensureDir(path.join(root, "Beta", workspaceMarker));

    const cached = await loadWorkspaces();
    const refreshed = await loadWorkspaces({ forceRefresh: true });

    expect(initial.fromCache).toBe(false);
    expect(cached).toEqual({
      workspaces: [{ name: "Alpha", path: path.join(root, "Alpha") }],
      invalidRoots: [],
      fromCache: true,
    });
    expect(refreshed.fromCache).toBe(false);
    expect(refreshed.workspaces).toEqual([
      { name: "Alpha", path: path.join(root, "Alpha") },
      { name: "Beta", path: path.join(root, "Beta") },
    ]);
  });
});
