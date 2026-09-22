import os from "node:os";
import path from "node:path";
import type { IndexedNote } from "@type/notes";
import { normalizeText, tokenize } from "@lib/utils";

const EXCERPT_OFFSET = 80;
const EXCERPT_LENGTH = 200;

export const OCTARINE_DB_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Octarine",
  "octarine.sqlite",
);

export type ContentMatch = {
  excerpt: string;
};

/** Why a note appears in the results. Metadata matches take precedence, so an excerpt is only reported for content matches. */
export type NoteMatch = { kind: "metadata" } | { kind: "content"; excerpt: string };

export type NoteMatchOptions = {
  matchesMetadata: (note: IndexedNote) => boolean;
  contentMatches: ReadonlyMap<string, ContentMatch>;
};

/**
 * A row returned by `buildContentSearchQuery`. `queryKey` ties it to the query
 * that produced it, so stale results can be discarded while a new one loads.
 */
export type ContentMatchRow = {
  queryKey: string;
  workspacePath: string;
  path: string;
  excerpt: string;
};

/**
 * Builds the read-only query that finds notes whose body or frontmatter contain
 * every normalized term (AND). Returns `undefined` when the input has no terms.
 *
 * Terms are matched literally with `instr` (no `LIKE` wildcards) and quoted as
 * SQL strings. Matching is case-insensitive for the non-ASCII characters
 * present in the query, but not accent-insensitive. The query returns only the
 * workspace, note path and a bounded excerpt; note bodies never leave SQLite.
 */
export function buildContentSearchQuery(input: string): string | undefined {
  const key = contentSearchKey(input);
  if (!key) return undefined;

  const tokens = tokenize(key);
  const values = tokens.map(sqlText);
  const first = values[0];
  const content = "bodyText || char(10) || frontmatterText";
  const predicates = values.map((value) => `instr(${content}, ${value}) > 0`).join("\n  AND ");

  return `WITH docs AS (
  SELECT
    w.path AS workspacePath,
    d.path,
    d.body,
    d.frontmatter,
    ${foldText("d.body", tokens)} AS bodyText,
    ${foldText("d.frontmatter", tokens)} AS frontmatterText
  FROM search_documents d
  JOIN workspaces w ON w.id = d.workspace_id
)
SELECT
  ${sqlText(key)} AS queryKey,
  workspacePath,
  path,
  CASE
    WHEN instr(bodyText, ${first}) > 0 THEN ${excerpt("body", "bodyText", first)}
    ELSE ${excerpt("frontmatter", "frontmatterText", first)}
  END AS excerpt
FROM docs
WHERE ${predicates}
ORDER BY workspacePath, path;`;
}

/**
 * Normalizes raw search text into the query key. The key is embedded in the SQL
 * as `queryKey` so results can be tied to the search that produced them.
 */
export function contentSearchKey(input: string): string | undefined {
  return normalizeText(input) || undefined;
}

/**
 * Maps query rows to content matches keyed by `noteSearchKey`, ignoring rows
 * from a different query and rows without a usable excerpt.
 */
export function toContentMatches(rows: ContentMatchRow[], currentKey: string): Map<string, ContentMatch> {
  const matches = new Map<string, ContentMatch>();

  for (const row of rows) {
    if (
      row.queryKey !== currentKey ||
      typeof row.workspacePath !== "string" ||
      typeof row.path !== "string" ||
      typeof row.excerpt !== "string"
    ) {
      continue;
    }

    const excerpt = row.excerpt.replace(/\s+/g, " ").trim();
    if (!excerpt) continue;

    matches.set(noteSearchKey(row.workspacePath, row.path), { excerpt: `…${excerpt}…` });
  }

  return matches;
}

export function noteSearchKey(workspacePath: string, notePath: string): string {
  return `${workspacePath}\0${notePath}`;
}

export function noteMatch(
  note: IndexedNote,
  { matchesMetadata, contentMatches }: NoteMatchOptions,
): NoteMatch | undefined {
  if (matchesMetadata(note)) return { kind: "metadata" };

  const match = contentMatches.get(noteSearchKey(note.folder.workspace.path, note.path));
  return match ? { kind: "content", excerpt: match.excerpt } : undefined;
}

/** SQL expression for a single-line excerpt around the first match, or the column start. */
function excerpt(field: string, searchField: string, value: string): string {
  return `trim(replace(replace(replace(substr(${field}, max(1, instr(${searchField}, ${value}) - ${EXCERPT_OFFSET}), ${EXCERPT_LENGTH}), char(10), ' '), char(13), ' '), char(9), ' '))`;
}

/**
 * Builds the SQL expression that lowercases `field` the same way search terms
 * are lowercased. SQLite's `lower()` only folds ASCII, so this adds one-to-one
 * replacements for the uppercase forms of the non-ASCII characters in `tokens`.
 * Replacements preserve length, keeping positions aligned with the raw column.
 */
function foldText(field: string, tokens: string[]): string {
  let folded = `lower(${field})`;
  const replacements = new Map<string, string>();

  for (const char of tokens.join("")) {
    if (char.codePointAt(0)! <= 0x7f) continue;

    const upper = char.toUpperCase();
    if ([...upper].length === 1 && upper !== char) replacements.set(upper, char);
  }

  for (const [upper, lower] of replacements) {
    folded = `replace(${folded}, ${sqlText(upper)}, ${sqlText(lower)})`;
  }

  return folded;
}

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
