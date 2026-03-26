import { normalize } from "./search";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/i;
const NATURAL_EXACT_PATTERN = /^(today|yesterday|tomorrow)$/i;
const RELATIVE_PATTERN = /^(?:\d+\s+(?:day|days|week|weeks)\s+ago|in\s+\d+\s+(?:day|days|week|weeks))$/i;
const DAY_MODIFIER_PATTERN = /^(?:last|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
const WEEK_MODIFIER_PATTERN = /^(?:this|last|next)\s+week$/i;
const PARTIAL_DATE_PATTERN =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}$/i;

export const DAILY_DESK_DATE_FORMATS_MARKDOWN = [
  "# Invalid Date",
  "",
  "**Supported Date Formats**",
  "",
  "- ISO date: `2024-01-15`, `2024-12-25`",
  "- ISO week: `2024-W03`, `2026-W01`",
  "- Natural language dates: `today`, `yesterday`, `tomorrow`",
  "- Relative dates: `2 days ago`, `next monday`, `last friday`",
  "- Partial dates: `jan 15`, `december 25`, `nov 3`",
  "- Natural language weeks: `this week`, `last week`, `next week`",
  "- Relative weeks: `2 weeks ago`, `in 2 weeks`",
].join("\n");

export function isSupportedDailyDeskDate(value: string): boolean {
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
