import { describe, expect, it } from "vitest";
import { getWorkspacesCache, setWorkspacesCache } from "../../src/lib/cache";
import { setMockCacheValue } from "../__mocks__/@raycast/api";

const WORKSPACES_CACHE_KEY = "octarine.workspaces.v1";

describe("workspace cache", () => {
  it("returns undefined when the key is missing", () => {
    const result = getWorkspacesCache();

    expect(result).toBeUndefined();
  });

  it("returns cached workspaces when the cached value is valid", () => {
    setMockCacheValue(
      WORKSPACES_CACHE_KEY,
      JSON.stringify([
        { name: "Alpha", path: "/workspaces/alpha" },
        { name: "Beta", path: "/workspaces/beta" },
      ]),
    );

    const result = getWorkspacesCache();

    expect(result).toEqual([
      { name: "Alpha", path: "/workspaces/alpha" },
      { name: "Beta", path: "/workspaces/beta" },
    ]);
  });

  it("returns undefined when the cached value is malformed", () => {
    setMockCacheValue(WORKSPACES_CACHE_KEY, "{");

    const result = getWorkspacesCache();

    expect(result).toBeUndefined();
  });

  it("returns undefined when the cached value is not a valid workspace list", () => {
    setMockCacheValue(WORKSPACES_CACHE_KEY, JSON.stringify([{ name: "Alpha", path: 1 }]));

    const result = getWorkspacesCache();

    expect(result).toBeUndefined();
  });

  it("stores workspaces as cacheable data", () => {
    setWorkspacesCache([{ name: "Alpha", path: "/workspaces/alpha" }]);

    expect(getWorkspacesCache()).toEqual([{ name: "Alpha", path: "/workspaces/alpha" }]);
  });
});
