import { normalizeText } from "./utils";

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}-W\d{2}$/i,
  /^(today|yesterday|tomorrow)$/i,
  /^(?:\d+\s+(?:day|days|week|weeks)\s+ago|in\s+\d+\s+(?:day|days|week|weeks))$/i,
  /^(?:last|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
  /^(?:this|last|next)\s+week$/i,
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}$/i,
] as const;

export function isSupportedDate(value: string): boolean {
  const date = normalizeText(value);
  return !!date && DATE_PATTERNS.some((pattern) => pattern.test(date));
}
