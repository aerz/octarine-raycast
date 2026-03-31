type ScopeMatch = {
  remainder: string;
  scopes: string[];
};

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizePath(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function extractScopeFromQuery(candidates: string[], query: string): ScopeMatch | undefined {
  const words = tokenize(query.trim());
  const normCandidates = candidates.map(normalizeText);

  for (let len = words.length - 1; len >= 1; len--) {
    const norm = normalizeText(words.slice(0, len).join(" "));
    const scopes = candidates.filter((_, i) => normCandidates[i] === norm || normCandidates[i].startsWith(`${norm} `));

    if (scopes.length > 0) {
      return { remainder: words.slice(len).join(" "), scopes };
    }
  }

  return undefined;
}
