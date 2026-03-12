export function normalizeSearchQuery(searchText: string): string {
  return searchText.trim().toLowerCase();
}

export function tokenizeSearchQuery(normalizedQuery: string): string[] {
  if (!normalizedQuery) {
    return [];
  }

  return normalizedQuery.split(/\s+/).filter(Boolean);
}

export function buildSearchIndexText(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

export function matchesSearchIndex(searchIndexText: string, searchText: string): boolean {
  const normalizedQuery = normalizeSearchQuery(searchText);
  const tokens = tokenizeSearchQuery(normalizedQuery);

  return tokens.length === 0 || tokens.every((token) => searchIndexText.includes(token));
}
