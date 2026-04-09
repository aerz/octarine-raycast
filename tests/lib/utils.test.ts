import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  expandHome,
  extractScopeFromQuery,
  normalizeSearchText,
  normalizeWorkspaceRoots,
  normalizeText,
  splitList,
  tokenize,
} from "../../src/lib/utils";

describe("utils", () => {
  it("returns the longest matching query prefix", () => {
    const result = extractScopeFromQuery(["Daily Desk", "Daily Notes", "Projects"], "Daily Desk today");

    expect(result).toEqual({
      remainder: "today",
      scopes: ["Daily Desk"],
    });
  });

  it("returns undefined when no matching prefix leaves a remainder", () => {
    expect(extractScopeFromQuery(["Daily Desk"], "daily")).toBeUndefined();
    expect(extractScopeFromQuery(["Daily Desk"], "random topic today")).toBeUndefined();
  });

  it("normalizes text and tokenizes safely", () => {
    expect(normalizeText("  Team   Standup  ")).toBe("team standup");
    expect(normalizeText()).toBe("");
    expect(tokenize("team   standup   notes")).toEqual(["team", "standup", "notes"]);
    expect(tokenize("")).toEqual([]);
  });

  it("normalizes path strings and expands workspace roots", () => {
    expect(normalizeSearchText("  C:\\Users\\Me\\\\Notes  ")).toBe("c:/users/me/notes");
    expect(expandHome("~")).toBe(os.homedir());
    expect(expandHome("~/Octarine")).toBe(path.join(os.homedir(), "Octarine"));
    expect(expandHome("/tmp/octarine")).toBe("/tmp/octarine");
    expect(splitList(" a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(normalizeWorkspaceRoots("~/Octarine, ./fixtures/workspaces, ~/Octarine")).toEqual([
      path.normalize(path.join(os.homedir(), "Octarine")),
      path.normalize(path.resolve("./fixtures/workspaces")),
    ]);
  });
});
