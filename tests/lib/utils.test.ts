import { describe, expect, it } from "vitest";
import { extractScopeFromQuery, normalizeText, tokenize } from "../../src/lib/utils";

describe("utils", () => {
  it("returns the longest matching query prefix", () => {
    const result = extractScopeFromQuery(["Daily Desk", "Daily Notes", "Projects"], "daily desk today");

    expect(result).toEqual({
      remainder: "today",
      scopes: ["Daily Desk"],
    });
  });

  it("returns undefined when no matching prefix leaves a remainder", () => {
    expect(extractScopeFromQuery(["Daily Desk"], "daily")).toBeUndefined();
    expect(extractScopeFromQuery(["Daily Desk"], "random topic today")).toBeUndefined();
  });

  it("normalizes whitespace and tokenizes safely", () => {
    expect(normalizeText("  Team   Standup  ")).toBe("team standup");
    expect(tokenize("team   standup   notes")).toEqual(["team", "standup", "notes"]);
    expect(tokenize("")).toEqual([]);
  });
});
