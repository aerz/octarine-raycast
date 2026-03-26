import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeDir, writeTextFile } from "../../tests/helpers/fs";
import { scanViewsFromWorkspaces } from "./views";
import { loadWorkspaces } from "./workspaces";

vi.mock("./workspaces", () => ({
  loadWorkspaces: vi.fn(),
}));

const loadWorkspacesMock = vi.mocked(loadWorkspaces);

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();

  if (tempDir) {
    await removeDir(tempDir);
    tempDir = undefined;
  }
});

describe("scanViewsFromWorkspaces", () => {
  it("parses valid view files and skips malformed or invalid ones", async () => {
    tempDir = await createTempDir("octarine-views");

    const validWorkspace = { name: "Valid", path: path.join(tempDir, "Valid") };
    const malformedWorkspace = { name: "Malformed", path: path.join(tempDir, "Malformed") };
    const invalidWorkspace = { name: "Invalid", path: path.join(tempDir, "Invalid") };
    const missingWorkspace = { name: "Missing", path: path.join(tempDir, "Missing") };

    loadWorkspacesMock.mockResolvedValue({
      workspaces: [validWorkspace, malformedWorkspace, invalidWorkspace, missingWorkspace],
      invalidRoots: [],
      fromCache: false,
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
});
