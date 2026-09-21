import { normalizeSearchText, tokenize } from "./utils";

export type SearchableItem = {
  searchText: string;
};

export function buildSearchText(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

/**
 * Builds a reusable matcher so the query is normalized and tokenized once.
 *
 * @param query Raw search query.
 */
export function createSearchMatcher(query: string): (item: SearchableItem) => boolean {
  const normalized = normalizeSearchText(query);

  if (!normalized) {
    return () => true;
  }

  const tokens = tokenize(normalized);
  return (item) => tokens.every((token) => item.searchText.includes(token));
}

export function querySearchText(item: SearchableItem, query: string): boolean {
  return createSearchMatcher(query)(item);
}
