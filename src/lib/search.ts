import { normalizeSearchText, tokenize } from "./utils";

export type SearchableItem = {
  searchText: string;
};

export function querySearchText(item: SearchableItem, query: string): boolean {
  const normalized = normalizeSearchText(query);

  if (!normalized) {
    return true;
  }

  return tokenize(normalized).every((token) => item.searchText.includes(token));
}

export function buildSearchText(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}
