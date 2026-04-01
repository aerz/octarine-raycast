import { describe, expect, it } from "vitest";
import { buildSearchIndexText, matchesPathSearch, matchesSearchIndex } from "../../src/lib/search";

type SearchableItem = {
  searchText: string;
  normalizedTitle: string;
  normalizedPath: string;
  normalizedDirectory: string;
  directorySegments: string[];
};

function createItem({
  title,
  notePath,
  workspaceName = "Workspace",
}: {
  title: string;
  notePath: string;
  workspaceName?: string;
}): SearchableItem {
  const normalizedTitle = title.toLowerCase();
  const normalizedPath = notePath.toLowerCase();
  const directory = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";

  return {
    searchText: buildSearchIndexText(title, notePath, workspaceName),
    normalizedTitle,
    normalizedPath,
    normalizedDirectory: directory,
    directorySegments: directory.split("/").filter(Boolean),
  };
}

describe("matchesPathSearch", () => {
  it("matches empty queries", () => {
    const item = createItem({
      title: "Team Standup",
      notePath: "daily/team-standup.md",
    });

    expect(matchesPathSearch(item, "")).toBe(true);
  });

  it("matches plain multi-token queries against the search index", () => {
    const item = createItem({
      title: "Team Standup",
      notePath: "daily/team-standup.md",
      workspaceName: "Work",
    });

    expect(matchesPathSearch(item, "standup work")).toBe(true);
    expect(matchesPathSearch(item, "standup personal")).toBe(false);
  });

  it("matches trailing slash queries against directory scope at any depth", () => {
    const item = createItem({
      title: "Retro",
      notePath: "projects/client-a/meetings/retro.md",
    });

    expect(matchesPathSearch(item, "client-a/")).toBe(true);
    expect(matchesPathSearch(item, "/meetings/")).toBe(true);
    expect(matchesPathSearch(item, "archive/")).toBe(false);
  });

  it("matches slash queries against fuzzy path or directory substrings", () => {
    const item = createItem({
      title: "Retro",
      notePath: "projects/client-a/meetings/retro.md",
    });

    expect(matchesPathSearch(item, "client-a/meet")).toBe(true);
    expect(matchesPathSearch(item, "projects/client-a/meetings/ret")).toBe(true);
  });

  it("matches slash queries using scoped title matching under a directory prefix", () => {
    const item = createItem({
      title: "Team Standup Notes",
      notePath: "daily/2026/team-standup-notes.md",
    });

    expect(matchesPathSearch(item, "daily/team standup")).toBe(true);
  });

  it("does not match when directory scope and title tokens do not align", () => {
    const item = createItem({
      title: "Team Standup Notes",
      notePath: "daily/2026/team-standup-notes.md",
    });

    expect(matchesPathSearch(item, "archive/team standup")).toBe(false);
    expect(matchesPathSearch(item, "daily/retro")).toBe(false);
  });
});

describe("search helpers", () => {
  it("matches trimmed lowercase tokens against a search index", () => {
    expect(matchesSearchIndex("team standup work", "  standup   work ")).toBe(true);
    expect(matchesSearchIndex("team standup work", "  STANDUP   work ")).toBe(true);
    expect(matchesSearchIndex("team standup work", "standup personal")).toBe(false);
  });
});
