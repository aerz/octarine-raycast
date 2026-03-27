import { matchQueryPrefix, normalize } from "./search";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/i;
const NATURAL_EXACT_PATTERN = /^(today|yesterday|tomorrow)$/i;
const RELATIVE_PATTERN = /^(?:\d+\s+(?:day|days|week|weeks)\s+ago|in\s+\d+\s+(?:day|days|week|weeks))$/i;
const DAY_MODIFIER_PATTERN = /^(?:last|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
const WEEK_MODIFIER_PATTERN = /^(?:this|last|next)\s+week$/i;
const PARTIAL_DATE_PATTERN =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}$/i;

export type DailyDeskItem = {
  date: string;
  id: string;
  kind: "daily-desk";
  title: string;
  workspace: string;
};

export function isDailyDeskDate(value: string): boolean {
  const normalized = normalize(value);

  if (!normalized) {
    return false;
  }

  return (
    ISO_DATE_PATTERN.test(normalized) ||
    ISO_WEEK_PATTERN.test(normalized) ||
    NATURAL_EXACT_PATTERN.test(normalized) ||
    RELATIVE_PATTERN.test(normalized) ||
    DAY_MODIFIER_PATTERN.test(normalized) ||
    WEEK_MODIFIER_PATTERN.test(normalized) ||
    PARTIAL_DATE_PATTERN.test(normalized)
  );
}

export function buildDailyDeskItems(workspaces: string[], text: string): DailyDeskItem[] {
  const search = text.trim();

  if (!search) {
    return [];
  }

  const match = matchQueryPrefix(workspaces, search);
  if (match) {
    return match.matches.map((workspace) => ({
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
