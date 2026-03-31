import { extractScopeFromQuery, normalizeText } from "./utils";

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}-W\d{2}$/i,
  /^(today|yesterday|tomorrow)$/i,
  /^(?:\d+\s+(?:day|days|week|weeks)\s+ago|in\s+\d+\s+(?:day|days|week|weeks))$/i,
  /^(?:last|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
  /^(?:this|last|next)\s+week$/i,
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}$/i,
] as const;

export type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  title: string;
  workspace: string;
};

export function isSupportedDate(value: string): boolean {
  const date = normalizeText(value);
  return !!date && DATE_PATTERNS.some((pattern) => pattern.test(date));
}

export function buildDailyDeskItems(workspaces: string[], text: string): DailyDeskItem[] {
  const search = text.trim();

  if (!search) {
    return [];
  }

  const match = extractScopeFromQuery(workspaces, search);
  if (match) {
    return match.scopes.map((workspace) => ({
      date: match.remainder,
      id: `daily-desk::${workspace}::${match.remainder}`,
      kind: "daily-desk",
      title: `Use "${match.remainder}" in Daily Desk`,
      workspace,
    }));
  }

  return workspaces.map((workspace) => ({
    date: search,
    id: `daily-desk::${workspace}::${search}`,
    kind: "daily-desk",
    title: `Use "${search}" in Daily Desk`,
    workspace,
  }));
}

export function isDailyDeskItem(item: unknown): item is DailyDeskItem {
  return typeof item === "object" && item !== null && "kind" in item && item.kind === "daily-desk";
}
