import { Cache } from "@raycast/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkspacesCache, setWorkspacesCache } from "../../src/lib/cache";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspace cache", () => {
  it("returns undefined when the key is missing", () => {
    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("returns cached workspaces when the cached value is valid", () => {
    setWorkspacesCache(
      [
        { name: "Alpha", path: "/workspaces/alpha" },
        { name: "Beta", path: "/workspaces/beta" },
      ],
      ["/workspaces"],
    );

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toEqual([
      { name: "Alpha", path: "/workspaces/alpha" },
      { name: "Beta", path: "/workspaces/beta" },
    ]);
  });

  it("returns undefined when the cached value is malformed", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue("{");

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("returns undefined when the cached value is not a valid workspace list", () => {
    vi.spyOn(Cache.prototype, "get").mockReturnValue(JSON.stringify([{ name: "Alpha", path: 1 }]));

    const result = getWorkspacesCache(["/workspaces"]);

    expect(result).toBeUndefined();
  });

  it("stores workspaces under a roots-specific cache key", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces"]);

    expect(getWorkspacesCache(["/workspaces"])).toEqual([{ name: "Alpha", path: "/workspaces/alpha" }]);
  });

  it("keeps caches for different workspace roots separate", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }], ["/workspaces-a"]);
    setWorkspacesCache([{ name: "Beta", path: "/workspaces/beta" }], ["/workspaces-b"]);

    expect(getWorkspacesCache(["/workspaces-a"])).toEqual([{ name: "Alpha", path: "/workspaces/alpha" }]);
    expect(getWorkspacesCache(["/workspaces-b"])).toEqual([{ name: "Beta", path: "/workspaces/beta" }]);
  });

  it("treats the same workspace roots in different orders as the same cache entry", () => {
    setWorkspacesCache(
      [{ name: "Alpha", path: "/workspaces/alpha" }],
      ["/workspaces-b", "/workspaces-a"],
    );

    expect(getWorkspacesCache(["/workspaces-a", "/workspaces-b"])).toEqual([
      { name: "Alpha", path: "/workspaces/alpha" },
    ]);
  });
});
