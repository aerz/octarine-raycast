import path from "node:path";
import { Cache } from "@raycast/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeDir, writeTextFile } from "../helpers/fs";
import { getViews } from "../../src/lib/views";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("views", () => {
  it("throws for malformed view files", async () => {
    tempDir = await createTempDir("octarine-views");

    const malformedWorkspace = { name: "Malformed", path: path.join(tempDir, "Malformed") };

    await writeTextFile(path.join(malformedWorkspace.path, ".octarine", "views.json"), "{not-json");

    await expect(getViews([malformedWorkspace], { refresh: true })).rejects.toThrow(
      `Failed to parse file ${path.join(malformedWorkspace.path, ".octarine", "views.json")}`,
    );
  });

  it("parses valid view files and skips invalid or missing ones", async () => {
    tempDir = await createTempDir("octarine-views-valid");

    const validWorkspace = { name: "Valid", path: path.join(tempDir, "Valid") };
    const invalidWorkspace = { name: "Invalid", path: path.join(tempDir, "Invalid") };
    const missingWorkspace = { name: "Missing", path: path.join(tempDir, "Missing") };

    await writeTextFile(
      path.join(validWorkspace.path, ".octarine", "views.json"),
      JSON.stringify([
        { id: "", name: " Inbox ", desc: "  Incoming work " },
        { name: "Archive", desc: "" },
      ]),
    );
    await writeTextFile(
      path.join(invalidWorkspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Good" }, { desc: "missing name" }]),
    );

    expect(await getViews([validWorkspace, invalidWorkspace, missingWorkspace], { refresh: true })).toEqual([
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
    ]);
  });

  it("reuses cached views until a refresh is requested", async () => {
    tempDir = await createTempDir("octarine-views-cache");

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Inbox", desc: "Initial" }]),
    );

    const initial = await getViews([workspace]);

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Archive", desc: "Updated" }]),
    );

    const cached = await getViews([workspace]);
    const refreshed = await getViews([workspace], { refresh: true });

    expect(initial.map((view) => view.name)).toEqual(["Inbox"]);
    expect(cached.map((view) => view.name)).toEqual(["Inbox"]);
    expect(refreshed.map((view) => view.name)).toEqual(["Archive"]);
  });

  it("ignores cached views when the workspace set changes", async () => {
    tempDir = await createTempDir("octarine-views-workspace-change");

    const work = { name: "Work", path: path.join(tempDir, "Work") };
    const personal = { name: "Personal", path: path.join(tempDir, "Personal") };

    await writeTextFile(path.join(work.path, ".octarine", "views.json"), JSON.stringify([{ name: "Inbox", desc: "" }]));
    await writeTextFile(
      path.join(personal.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Side", desc: "" }]),
    );

    expect((await getViews([work])).map((view) => view.id)).toEqual([`${work.path}::0`]);
    expect((await getViews([work, personal])).map((view) => view.id)).toEqual([
      `${work.path}::0`,
      `${personal.path}::0`,
    ]);
  });

  it("ignores malformed cached payloads", async () => {
    tempDir = await createTempDir("octarine-views-malformed-cache");

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };

    await writeTextFile(path.join(workspace.path, ".octarine", "views.json"), JSON.stringify([{ name: "Inbox", desc: "" }]));

    vi.spyOn(Cache.prototype, "get").mockReturnValue("{");

    expect((await getViews([workspace])).map((view) => view.name)).toEqual(["Inbox"]);
  });

  it("ignores cached views with the wrong payload shape", async () => {
    tempDir = await createTempDir("octarine-views-invalid-cache");

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };

    await writeTextFile(path.join(workspace.path, ".octarine", "views.json"), JSON.stringify([{ name: "Inbox", desc: "" }]));

    vi.spyOn(Cache.prototype, "get").mockReturnValue(
      JSON.stringify({
        cachedAt: Date.now(),
        data: [{ id: "view-1", name: "Inbox", description: "", workspace: { name: "Work", path: 1 } }],
      }),
    );

    expect((await getViews([workspace])).map((view) => view.name)).toEqual(["Inbox"]);
  });

  it("rescans when the views cache is stale", async () => {
    tempDir = await createTempDir("octarine-views-stale-cache");

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };
    const now = new Date("2026-03-31T10:00:00.000Z").valueOf();
    const nowSpy = vi.spyOn(Date, "now");

    await writeTextFile(path.join(workspace.path, ".octarine", "views.json"), JSON.stringify([{ name: "Inbox", desc: "" }]));

    nowSpy.mockReturnValue(now);
    expect((await getViews([workspace])).map((view) => view.name)).toEqual(["Inbox"]);

    await writeTextFile(path.join(workspace.path, ".octarine", "views.json"), JSON.stringify([{ name: "Review", desc: "" }]));

    nowSpy.mockReturnValue(now + 24 * 60 * 60 * 1000);
    expect((await getViews([workspace])).map((view) => view.name)).toEqual(["Review"]);
  });

  it("stores refreshed results for subsequent reads", async () => {
    tempDir = await createTempDir("octarine-views-refresh-cache");

    const workspace = { name: "Work", path: path.join(tempDir, "Work") };

    await writeTextFile(path.join(workspace.path, ".octarine", "views.json"), JSON.stringify([{ name: "Inbox", desc: "" }]));

    await getViews([workspace]);

    await writeTextFile(
      path.join(workspace.path, ".octarine", "views.json"),
      JSON.stringify([{ name: "Review", desc: "Needs attention" }]),
    );

    await getViews([workspace], { refresh: true });

    expect((await getViews([workspace])).map((view) => view.name)).toEqual(["Review"]);
  });
});
