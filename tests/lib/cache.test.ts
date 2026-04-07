import { Cache } from "@raycast/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPinnedNotesCache, getWorkspacesCache, setPinnedNotesCache, setWorkspacesCache } from "../../src/lib/cache";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("workspace cache", () => {
  const staleOffsetMs = 24 * 60 * 60 * 1000;

  it("returns undefined when the key is missing", () => {
    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("returns cached workspaces when the cached value is valid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T10:00:00.000Z"));

    const cached = {
      workspaces: [
        { name: "Alpha", path: "/workspaces/alpha" },
        { name: "Beta", path: "/workspaces/beta" },
      ],
      invalidRoots: ["/workspaces/missing"],
    };

    setWorkspacesCache(cached.workspaces, ["/workspaces"], cached.invalidRoots);

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toEqual(cached);
  });

  it("returns undefined when the cached value is stale", () => {
    const now = new Date("2026-03-31T10:00:00.000Z").valueOf();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(now);

    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces"], []);
    nowSpy.mockReturnValue(now + staleOffsetMs);

    expect(getWorkspacesCache(["/workspaces"])).toBeUndefined();
  });

  it("returns undefined when the cached value is malformed", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue("{");

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("returns undefined when the cached value is not a valid workspace payload", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue(
      JSON.stringify({ cachedAt: Date.now(), data: { workspaces: [{ name: "Alpha", path: 1 }], invalidRoots: [] } }),
    );

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("stores workspaces under a roots-specific cache key", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces"], []);

    expect(getWorkspacesCache(["/workspaces"])).toEqual({
      workspaces: [{ name: "Alpha", path: "/workspaces/alpha" }],
      invalidRoots: [],
    });
  });

  it("keeps caches for different workspace roots separate", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces-a"], []);
    setWorkspacesCache([{ name: "Beta", path: "/workspaces/beta" }], ["/workspaces-b"], ["/workspaces-b/missing"]);

    expect(getWorkspacesCache(["/workspaces-a"])).toEqual({
      workspaces: [{ name: "Alpha", path: "/workspaces/alpha" }],
      invalidRoots: [],
    });
    expect(getWorkspacesCache(["/workspaces-b"])).toEqual({
      workspaces: [{ name: "Beta", path: "/workspaces/beta" }],
      invalidRoots: ["/workspaces-b/missing"],
    });
  });

  it("treats the same workspace roots in different orders as the same cache entry", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces-b", "/workspaces-a"], [
      "/workspaces-missing",
    ]);

    expect(getWorkspacesCache(["/workspaces-a", "/workspaces-b"])).toEqual({
      workspaces: [{ name: "Alpha", path: "/workspaces/alpha" }],
      invalidRoots: ["/workspaces-missing"],
    });
  });
});

describe("pinned notes cache", () => {
  const staleOffsetMs = 24 * 60 * 60 * 1000;
  const workspaces = [{ name: "Alpha", path: "/workspaces/alpha" }];
  const notes = [
    {
      id: "Alpha::Pinned.md",
      title: "Pinned",
      path: "Pinned.md",
      workspace: workspaces[0],
      pinned: true,
      normalizedTitle: "pinned",
      normalizedPath: "pinned.md",
      normalizedWorkspace: "alpha",
      normalizedDirectory: "",
      directorySegments: [],
      searchText: "pinned pinned.md alpha",
    },
  ];

  it("returns cached pinned notes when the cached value is valid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T10:00:00.000Z"));

    setPinnedNotesCache(notes, workspaces, new Set(["archive"]));

    expect(getPinnedNotesCache(workspaces, new Set(["archive"]))).toEqual(notes);
  });

  it("returns cached empty pinned notes arrays", () => {
    setPinnedNotesCache([], workspaces, new Set());

    expect(getPinnedNotesCache(workspaces, new Set())).toEqual([]);
  });

  it("returns undefined when the pinned notes cache is stale", () => {
    const now = new Date("2026-03-31T10:00:00.000Z").valueOf();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(now);

    setPinnedNotesCache(notes, workspaces, new Set());
    nowSpy.mockReturnValue(now + staleOffsetMs);

    expect(getPinnedNotesCache(workspaces, new Set())).toBeUndefined();
  });

  it("returns undefined when the pinned notes cache is malformed", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue("{");

    expect(getPinnedNotesCache(workspaces, new Set())).toBeUndefined();
  });

  it("returns undefined when the pinned notes cache contains invalid notes", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue(
      JSON.stringify({
        cachedAt: Date.now(),
        notes: [{ id: "Alpha::Pinned.md", workspace: { name: "Alpha", path: 1 } }],
      }),
    );

    expect(getPinnedNotesCache(workspaces, new Set())).toBeUndefined();
  });

  it("keeps caches for different excluded directories separate", () => {
    setPinnedNotesCache(notes, workspaces, new Set(["archive"]));
    setPinnedNotesCache([], workspaces, new Set(["templates"]));

    expect(getPinnedNotesCache(workspaces, new Set(["archive"]))).toEqual(notes);
    expect(getPinnedNotesCache(workspaces, new Set(["templates"]))).toEqual([]);
  });

  it("keeps caches for different workspace sets separate", () => {
    const otherWorkspace = { name: "Beta", path: "/workspaces/beta" };

    setPinnedNotesCache(notes, workspaces, new Set());
    setPinnedNotesCache(
      [
        {
          id: "Beta::Pinned.md",
          title: "Pinned",
          path: "Pinned.md",
          workspace: otherWorkspace,
          pinned: true,
          normalizedTitle: "pinned",
          normalizedPath: "pinned.md",
          normalizedWorkspace: "beta",
          normalizedDirectory: "",
          directorySegments: [],
          searchText: "pinned pinned.md beta",
        },
      ],
      [otherWorkspace],
      new Set(),
    );

    expect(getPinnedNotesCache(workspaces, new Set())).toEqual(notes);
    expect(getPinnedNotesCache([otherWorkspace], new Set())).toEqual([
      {
        id: "Beta::Pinned.md",
        title: "Pinned",
        path: "Pinned.md",
        workspace: otherWorkspace,
        pinned: true,
        normalizedTitle: "pinned",
        normalizedPath: "pinned.md",
        normalizedWorkspace: "beta",
        normalizedDirectory: "",
        directorySegments: [],
        searchText: "pinned pinned.md beta",
      },
    ]);
  });
});
