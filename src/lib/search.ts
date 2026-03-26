export type QueryPrefixMatch = {
  remainder: string;
  matches: string[];
};

export type PathSearchableItem = {
  searchText: string;
  normalizedTitle: string;
  normalizedPath: string;
  normalizedDirectory: string;
  directorySegments: string[];
};

export function buildSearchIndexText(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

export function matchesSearchIndex(searchIndexText: string, searchText: string): boolean {
  const normalizedQuery = normalize(searchText);
  const tokens = tokenize(normalizedQuery);

  return tokens.length === 0 || tokens.every((token) => searchIndexText.includes(token));
}

export function matchesPathSearch(item: PathSearchableItem, searchText: string): boolean {
  const normalizedQuery = normalizePathQuery(searchText);
  if (!normalizedQuery) {
    return true;
  }

  const hasSlash = normalizedQuery.includes("/");

  if (!hasSlash) {
    const tokens = tokenize(normalizedQuery);
    return tokens.length === 0 || tokens.every((token) => item.searchText.includes(token));
  }

  const hasTrailingSlash = normalizedQuery.endsWith("/");
  const queryWithoutOuterSlashes = normalizedQuery.replace(/^\/+|\/+$/g, "");

  if (hasTrailingSlash) {
    return matchesDirectoryScopeAtAnyDepth(item.directorySegments, queryWithoutOuterSlashes);
  }

  const fuzzyPathMatch =
    item.normalizedDirectory.includes(queryWithoutOuterSlashes) ||
    item.normalizedPath.includes(queryWithoutOuterSlashes);

  const lastSlashIndex = queryWithoutOuterSlashes.lastIndexOf("/");
  const directoryPrefix = lastSlashIndex === -1 ? "" : queryWithoutOuterSlashes.slice(0, lastSlashIndex).trim();
  const titleQuery =
    lastSlashIndex === -1 ? queryWithoutOuterSlashes : queryWithoutOuterSlashes.slice(lastSlashIndex + 1).trim();
  const titleTokens = tokenize(titleQuery);

  const scopedTitleMatch =
    matchesDirectoryScopeAtAnyDepth(item.directorySegments, directoryPrefix) &&
    (titleTokens.length === 0 || titleTokens.every((token) => item.normalizedTitle.includes(token)));

  return fuzzyPathMatch || scopedTitleMatch;
}

export function matchQueryPrefix(candidates: string[], query: string): QueryPrefixMatch | undefined {
  const input = query.trim();
  const words = tokenize(input);

  for (let len = words.length - 1; len >= 1; len -= 1) {
    const head = words.slice(0, len).join(" ");
    const norm = normalize(head);
    const remainder = words.slice(len).join(" ");

    if (!remainder) {
      continue;
    }

    const matches = candidates.filter((w) => {
      const n = normalize(w);
      return n === norm || n.startsWith(`${norm} `);
    });

    if (matches.length > 0) {
      return { remainder, matches };
    }
  }

  return undefined;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePathQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function toPathSegments(pathValue: string): string[] {
  return pathValue
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesDirectoryScopeAtAnyDepth(noteDirectorySegments: string[], directoryQuery: string): boolean {
  const querySegments = toPathSegments(directoryQuery);
  if (querySegments.length === 0) {
    return true;
  }

  if (noteDirectorySegments.length < querySegments.length) {
    return false;
  }

  for (let start = 0; start <= noteDirectorySegments.length - querySegments.length; start += 1) {
    let matchesAllSegments = true;

    for (let index = 0; index < querySegments.length; index += 1) {
      if (noteDirectorySegments[start + index] !== querySegments[index]) {
        matchesAllSegments = false;
        break;
      }
    }

    if (matchesAllSegments) {
      return true;
    }
  }

  return false;
}

export function tokenize(query: string): string[] {
  if (!query) {
    return [];
  }

  return query.split(/\s+/).filter(Boolean);
}
