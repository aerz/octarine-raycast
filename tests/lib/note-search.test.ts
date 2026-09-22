import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  buildContentSearchQuery,
  noteSearchKey,
  OCTARINE_DB_PATH,
  toContentMatches,
  type ContentMatchRow,
} from "@lib/note-search";

describe("note content search", () => {
  it("resolves the Octarine database in Application Support", () => {
    expect(OCTARINE_DB_PATH).toBe(
      path.join(os.homedir(), "Library", "Application Support", "Octarine", "octarine.sqlite"),
    );
  });

  it("skips empty queries", () => {
    expect(buildContentSearchQuery("   ")).toBeUndefined();
  });

  it("requires every normalized token in note content", () => {
    const query = buildContentSearchQuery("  Project   Meeting  ");

    expect(query).toContain("instr(bodyText || char(10) || frontmatterText, 'project') > 0");
    expect(query).toContain("instr(bodyText || char(10) || frontmatterText, 'meeting') > 0");
    expect(query).toContain("JOIN workspaces w ON w.id = d.workspace_id");
    expect(query).toContain("substr(body");
  });

  it("matches non-ASCII content without case sensitivity", () => {
    const db = createSearchDb();
    db.prepare("INSERT INTO search_documents (workspace_id, path, body, frontmatter) VALUES (?, ?, ?, ?)").run(
      "work",
      "accented.md",
      "CAFÉ",
      "summary: Última",
    );

    const query = buildContentSearchQuery("café última");
    const rows = db.prepare(query ?? "").all() as ContentMatchRow[];
    db.close();

    expect(rows.map((row) => row.path)).toEqual(["accented.md"]);
    expect(rows[0].queryKey).toBe("café última");
    expect(rows[0].excerpt.length).toBeLessThanOrEqual(200);
  });

  it("builds the excerpt from frontmatter when the first token only appears there", () => {
    const db = createSearchDb();
    db.prepare("INSERT INTO search_documents (workspace_id, path, body, frontmatter) VALUES (?, ?, ?, ?)").run(
      "work",
      "frontmatter.md",
      "Unrelated body",
      "summary: Hidden context",
    );

    const query = buildContentSearchQuery("hidden");
    const rows = db.prepare(query ?? "").all() as ContentMatchRow[];
    db.close();

    expect(rows.map((row) => row.path)).toEqual(["frontmatter.md"]);
    expect(rows[0].excerpt).toContain("Hidden context");
  });

  it("excludes notes when any query token is missing", () => {
    const db = createSearchDb();
    db.prepare("INSERT INTO search_documents (workspace_id, path, body, frontmatter) VALUES (?, ?, ?, ?)").run(
      "work",
      "partial.md",
      "CAFÉ",
      "",
    );

    const query = buildContentSearchQuery("missing café");
    const rows = db.prepare(query ?? "").all() as ContentMatchRow[];
    db.close();

    expect(rows).toEqual([]);
  });

  it("escapes SQL text while treating wildcard characters literally", () => {
    const query = buildContentSearchQuery("author's 100%_plan");

    expect(query).toContain("'author''s'");
    expect(query).toContain("'100%_plan'");
    expect(query).not.toContain("LIKE");
  });

  it("executes queries containing SQL and wildcard characters", () => {
    const db = createSearchDb();
    db.prepare("INSERT INTO search_documents (workspace_id, path, body, frontmatter) VALUES (?, ?, ?, ?)").run(
      "work",
      "literal.md",
      "author's 100%_plan",
      "",
    );

    const query = buildContentSearchQuery("author's 100%_plan");
    const rows = db.prepare(query ?? "").all() as ContentMatchRow[];
    db.close();

    expect(rows.map((row) => row.path)).toEqual(["literal.md"]);
  });

  it("builds normalized excerpts keyed by workspace and note path", () => {
    const matches = toContentMatches(
      [
        {
          queryKey: "query",
          workspacePath: "/notes/Work",
          path: "projects/alpha.md",
          excerpt: "  first line\nsecond   line  ",
        },
      ],
      "query",
    );

    expect(matches.get(noteSearchKey("/notes/Work", "projects/alpha.md"))).toEqual({
      excerpt: "…first line second line…",
    });
  });

  it("ignores rows produced by a previous query", () => {
    const matches = toContentMatches(
      [{ queryKey: "previous", workspacePath: "/notes/Work", path: "project.md", excerpt: "old match" }],
      "current",
    );

    expect(matches.size).toBe(0);
  });

  it("ignores malformed or empty excerpts", () => {
    const rows = [
      { queryKey: "query", workspacePath: 42, path: "malformed.md", excerpt: "match" },
      { queryKey: "query", workspacePath: "/notes/Work", path: "empty.md", excerpt: "   " },
      { queryKey: "query", workspacePath: "/notes/Work", path: "valid.md", excerpt: "match" },
    ] as unknown as ContentMatchRow[];
    const matches = toContentMatches(rows, "query");

    expect(matches.has(noteSearchKey("42", "malformed.md"))).toBe(false);
    expect(matches.has(noteSearchKey("/notes/Work", "empty.md"))).toBe(false);
    expect(matches.has(noteSearchKey("/notes/Work", "valid.md"))).toBe(true);
  });
});

function createSearchDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, path TEXT NOT NULL);
    CREATE TABLE search_documents (
      workspace_id TEXT NOT NULL,
      path TEXT NOT NULL,
      body TEXT NOT NULL,
      frontmatter TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO workspaces (id, path) VALUES (?, ?)").run("work", "/notes/Work");
  return db;
}
