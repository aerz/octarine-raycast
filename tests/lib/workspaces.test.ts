import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import { loadWorkspaces } from "../../src/lib/workspaces";

const { scanWorkspacePaths } = vi.hoisted(() => ({
  scanWorkspacePaths: vi.fn(),
}));

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

vi.mock("../../src/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/files")>();
  return {
    ...actual,
    scanWorkspacePaths,
  };
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  scanWorkspacePaths.mockReset();
});

describe("loadWorkspaces", () => {
  const staleOffsetMs = 24 * 60 * 60 * 1000;

  it("maps discovered paths into sorted workspaces and passes invalid roots through", async () => {
    const root = "/tmp/root";
    const nestedRoot = "/tmp/root/nested";
    const invalidRoot = "/tmp/missing";

    setMockPreferences({
      workspaceRoots: `${root}, ${nestedRoot}, ${invalidRoot}`,
      excludedWorkspaces: "skipme",
      excludedFoldersInWorkspaces: "",
    });
    scanWorkspacePaths.mockResolvedValue({
      paths: ["/tmp/root/Beta", "/tmp/other/Alpha", "/tmp/root/Alpha"],
      invalidRoots: [invalidRoot],
    });

    const result = await loadWorkspaces();
    const [roots, excludedWorkspaces] = scanWorkspacePaths.mock.calls[0];

    expect(result.invalidRoots).toEqual([invalidRoot]);
    expect(result.workspaces).toEqual([
      { name: "Alpha", path: "/tmp/other/Alpha" },
      { name: "Alpha", path: "/tmp/root/Alpha" },
      { name: "Beta", path: "/tmp/root/Beta" },
    ]);
    expect(roots).toEqual([root, nestedRoot, invalidRoot]);
    expect(excludedWorkspaces).toEqual(new Set(["skipme"]));
  });

  it("reuses the cache until a refresh is requested", async () => {
    const root = "/tmp/root";

    setMockPreferences({
      workspaceRoots: root,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/root/Alpha"],
      invalidRoots: [],
    });

    const initial = await loadWorkspaces();
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/root/Alpha", "/tmp/root/Beta"],
      invalidRoots: [],
    });

    const cachedResult = await loadWorkspaces();
    const refreshed = await loadWorkspaces({ refresh: true });

    expect(initial).toEqual({
      workspaces: [{ name: "Alpha", path: "/tmp/root/Alpha" }],
      invalidRoots: [],
    });
    expect(cachedResult).toEqual({
      workspaces: [{ name: "Alpha", path: "/tmp/root/Alpha" }],
      invalidRoots: [],
    });
    expect(refreshed.workspaces).toEqual([
      { name: "Alpha", path: "/tmp/root/Alpha" },
      { name: "Beta", path: "/tmp/root/Beta" },
    ]);
    expect(scanWorkspacePaths).toHaveBeenCalledTimes(2);
  });

  it("ignores cached workspaces when workspaceRoots changes", async () => {
    const firstRoot = "/tmp/first-root";
    const secondRoot = "/tmp/second-root";

    setMockPreferences({
      workspaceRoots: firstRoot,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/first-root/Alpha"],
      invalidRoots: [],
    });

    const initial = await loadWorkspaces();

    setMockPreferences({
      workspaceRoots: secondRoot,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/second-root/Beta"],
      invalidRoots: [],
    });

    const changedRoots = await loadWorkspaces();

    expect(initial).toEqual({
      workspaces: [{ name: "Alpha", path: "/tmp/first-root/Alpha" }],
      invalidRoots: [],
    });
    expect(changedRoots).toEqual({
      workspaces: [{ name: "Beta", path: "/tmp/second-root/Beta" }],
      invalidRoots: [],
    });
  });

  it("rescans when the workspace cache is stale", async () => {
    const now = new Date("2026-03-31T10:00:00.000Z").valueOf();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(now);
    const root = "/tmp/root";

    setMockPreferences({
      workspaceRoots: root,
      excludedWorkspaces: "",
      excludedFoldersInWorkspaces: "",
    });
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/root/Alpha"],
      invalidRoots: [],
    });

    const initial = await loadWorkspaces();
    scanWorkspacePaths.mockResolvedValueOnce({
      paths: ["/tmp/root/Alpha", "/tmp/root/Beta"],
      invalidRoots: [],
    });
    nowSpy.mockReturnValue(now + staleOffsetMs);

    const stale = await loadWorkspaces();

    expect(initial).toEqual({
      workspaces: [{ name: "Alpha", path: "/tmp/root/Alpha" }],
      invalidRoots: [],
    });
    expect(stale).toEqual({
      workspaces: [
        { name: "Alpha", path: "/tmp/root/Alpha" },
        { name: "Beta", path: "/tmp/root/Beta" },
      ],
      invalidRoots: [],
    });
  });
});
