import path from "node:path";
import { LocalStorage } from "@raycast/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";
import { loadCachedViews, saveCachedViews, scanViewsFromWorkspaces } from "../../src/lib/views";
import { loadWorkspaces } from "../../src/lib/workspaces";

vi.mock("../../src/lib/workspaces", () => ({
  loadWorkspaces: vi.fn(),
}));

const loadWorkspacesMock = vi.mocked(loadWorkspaces);
const VIEWS_CACHE_KEY = "octarine.views.v1";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  loadWorkspacesMock.mockReset();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

function configurePreferences(workspaceRoot: string): void {
  setMockPreferences({
    workspaceRoots: workspaceRoot,
    excludedWorkspaces: "",
    excludedFoldersInWorkspaces: "",
  });
}

describe("views", () => {
  it("parses valid view files and skips malformed or invalid ones", async () => {
    tempDir = await createTempDir("octarine-views");
    configurePreferences(tempDir);

    const validWorkspace = { name: "Valid", path: path.join(tempDir, "Valid") };
    const malformedWorkspace = { name: "Malformed", path: path.join(tempDir, "Malformed") };
    const invalidWorkspace = { name: "Invalid", path: path.join(tempDir, "Invalid") };
    const missingWorkspace = { name: "Missing", path: path.join(tempDir, "Missing") };

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [validWorkspace, malformedWorkspace, invalidWorkspace, missingWorkspace],
      invalidRoots: [],
      cached: false,
    });

    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await writeTextFile(
      path.join(validWorkspace.path, ".octarine", "views.json"),
      JSON.stringify([
        { id: "", name: " Inbox ", desc: "  Incoming work " },
        { name: "Archive", desc: "" },
      ]),
    );
    await writeTextFile(path.join(malformedWorkspace.path, ".octarine", "views.json"), "{not-json");
    await writeTextFile(
      path.join(invalidWorkspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Good" }, { desc: "missing name" }]),
    );

    const result = await scanViewsFromWorkspaces();

    expect(result.workspaceCount).toBe(4);
    expect(result.workspaceViews).toEqual([
      {
        workspace: validWorkspace,
        views: [
          {
            id: `${validWorkspace.path}::1`,
            name: "Archive",
            description: "",
            workspace: validWorkspace,
            searchText: "archive valid",
          },
          {
            id: `${validWorkspace.path}::0`,
            name: "Inbox",
            description: "Incoming work",
            workspace: validWorkspace,
            searchText: "inbox incoming work valid",
          },
        ],
      },
    ]);
  });

  it("loads cached views when the signature matches", async () => {
    const workspace = { name: "Work", path: "/tmp/work" };
    const workspaceViews = [
      {
        workspace,
        views: [
          {
            id: "view-1",
            name: "Inbox",
            description: "Incoming work",
            workspace,
            searchText: "inbox incoming work work",
          },
        ],
      },
    ];

    await saveCachedViews([workspace], workspaceViews, "signature");

    expect(await loadCachedViews("signature")).toEqual({
      workspaces: [workspace],
      workspaceViews,
    });
  });

  it("ignores cached views when the signature does not match", async () => {
    const workspace = { name: "Work", path: "/tmp/work" };

    await saveCachedViews(
      [workspace],
      [
        {
          workspace,
          views: [
            {
              id: "view-1",
              name: "Inbox",
              description: "",
              workspace,
              searchText: "inbox work",
            },
          ],
        },
      ],
      "signature-a",
    );

    expect(await loadCachedViews("signature-b")).toBeUndefined();
  });

  it("ignores invalid cached payloads", async () => {
    await LocalStorage.setItem(
      VIEWS_CACHE_KEY,
      JSON.stringify({
        version: 1,
        workspaceDiscoverySignature: "signature",
        scannedAt: new Date().toISOString(),
        workspaces: [{ name: "Work", path: "/tmp/work" }],
        workspaceViews: [
          {
            workspace: { name: "Work", path: "/tmp/work" },
            views: [{ id: "view-1", name: "Inbox", description: "", workspace: { name: "Work", path: "/tmp/work" } }],
          },
        ],
      }),
    );

    expect(await loadCachedViews("signature")).toBeUndefined();
  });

  it("ignores cached views with the wrong cache version", async () => {
    await LocalStorage.setItem(
      VIEWS_CACHE_KEY,
      JSON.stringify({
        version: 99,
        workspaceDiscoverySignature: "signature",
        scannedAt: new Date().toISOString(),
        workspaces: [],
        workspaceViews: [],
      }),
    );

    expect(await loadCachedViews("signature")).toBeUndefined();
  });

  it("reuses cached views until a refresh is requested", async () => {
    tempDir = await createTempDir("octarine-views-cache");
    configurePreferences(tempDir);

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };
    const workspaceDiscoverySignature = `${path.resolve(tempDir)}::`;

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [workspace],
      invalidRoots: [],
      cached: false,
    });

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Inbox", desc: "Initial" }]),
    );

    const initial = await scanViewsFromWorkspaces();
    await saveCachedViews([workspace], initial.workspaceViews, workspaceDiscoverySignature);

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Archive", desc: "Updated" }]),
    );

    const refreshed = await scanViewsFromWorkspaces({ forceRefresh: true });
    const cached = await loadCachedViews(workspaceDiscoverySignature);

    expect(initial.cached).toBe(false);
    expect(initial.workspaceViews[0]?.views.map((view) => view.name)).toEqual(["Inbox"]);

    expect(cached).toEqual({
      workspaces: [workspace],
      workspaceViews: initial.workspaceViews,
    });

    expect(refreshed.cached).toBe(false);
    expect(refreshed.workspaceViews[0]?.views.map((view) => view.name)).toEqual(["Archive"]);
    expect(loadWorkspacesMock).toHaveBeenCalledTimes(2);
  });

  it("updates the stored cache after a forced refresh", async () => {
    tempDir = await createTempDir("octarine-views-refresh");
    configurePreferences(tempDir);

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };
    const workspaceDiscoverySignature = `${path.resolve(tempDir)}::`;

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [workspace],
      invalidRoots: [],
      cached: false,
    });

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Inbox", desc: "" }]),
    );

    await scanViewsFromWorkspaces({ forceRefresh: true });

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Review", desc: "Needs attention" }]),
    );

    const refreshed = await scanViewsFromWorkspaces({ forceRefresh: true });
    await saveCachedViews([workspace], refreshed.workspaceViews, workspaceDiscoverySignature);

    expect(
      (await loadCachedViews(workspaceDiscoverySignature))?.workspaceViews[0]?.views.map((view) => view.name),
    ).toEqual(["Review"]);
  });
});
