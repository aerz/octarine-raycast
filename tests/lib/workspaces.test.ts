import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, ensureDir, removeDir } from "../helpers/fs";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import { loadWorkspaces } from "../../src/lib/workspaces";

vi.mock("../../src/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/utils")>();

  return {
    ...actual,
    normalizeExtensions(input?: string) {
      return new Set(
        actual
          .splitList(input)
          .map((value) => value.replace(/^\./, "").toLowerCase())
          .filter(Boolean),
      );
    },
    splitLowerList(input?: string) {
      return new Set(actual.splitList(input).map((value) => value.toLowerCase()));
    },
  };
});

const workspaceMarker = ".octarine";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("loadWorkspaces", () => {
  const staleOffsetMs = 24 * 60 * 60 * 1000;

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

    expect(result.cached).toBe(false);
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
    const refreshed = await loadWorkspaces({ refresh: true });

    expect(initial.cached).toBe(false);
    expect(cached).toEqual({
      workspaces: [{ name: "Alpha", path: path.join(root, "Alpha") }],
      invalidRoots: [],
      cached: true,
    });
    expect(refreshed.cached).toBe(false);
    expect(refreshed.workspaces).toEqual([
      { name: "Alpha", path: path.join(root, "Alpha") },
      { name: "Beta", path: path.join(root, "Beta") },
    ]);
  });

  it("ignores cached workspaces when workspaceRoots changes", async () => {
    tempDir = await createTempDir("octarine-workspaces-root-change");

    const firstRoot = path.join(tempDir, "first-root");
    const secondRoot = path.join(tempDir, "second-root");
    await ensureDir(path.join(firstRoot, "Alpha", workspaceMarker));
    await ensureDir(path.join(secondRoot, "Beta", workspaceMarker));

    setMockPreferences({
      workspaceRoots: firstRoot,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });

    const initial = await loadWorkspaces();

    setMockPreferences({
      workspaceRoots: secondRoot,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });

    const changedRoots = await loadWorkspaces();

    expect(initial).toEqual({
      workspaces: [{ name: "Alpha", path: path.join(firstRoot, "Alpha") }],
      invalidRoots: [],
      cached: false,
    });
    expect(changedRoots).toEqual({
      workspaces: [{ name: "Beta", path: path.join(secondRoot, "Beta") }],
      invalidRoots: [],
      cached: false,
    });
  });

  it("rescans when the workspace cache is stale", async () => {
    const now = new Date("2026-03-31T10:00:00.000Z").valueOf();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(now);

    tempDir = await createTempDir("octarine-workspaces-stale-cache");

    const root = path.join(tempDir, "root");
    await ensureDir(path.join(root, "Alpha", workspaceMarker));

    setMockPreferences({
      workspaceRoots: root,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });

    const initial = await loadWorkspaces();

    await ensureDir(path.join(root, "Beta", workspaceMarker));
    nowSpy.mockReturnValue(now + staleOffsetMs);

    const stale = await loadWorkspaces();

    expect(initial).toEqual({
      workspaces: [{ name: "Alpha", path: path.join(root, "Alpha") }],
      invalidRoots: [],
      cached: false,
    });
    expect(stale).toEqual({
      workspaces: [
        { name: "Alpha", path: path.join(root, "Alpha") },
        { name: "Beta", path: path.join(root, "Beta") },
      ],
      invalidRoots: [],
      cached: false,
    });
  });
});
