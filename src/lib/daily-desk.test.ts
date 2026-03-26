import { describe, expect, it } from "vitest";
import { isSupportedDailyDeskDate } from "./daily-desk";

describe("isSupportedDailyDeskDate", () => {
  it.each([
    "2026-03-26",
    "2026-W13",
    "today",
    "yesterday",
    "tomorrow",
    "2 days ago",
    "in 2 weeks",
    "next monday",
    "last friday",
    "this week",
    "jan 15",
    "december 25",
  ])("accepts %s", (value) => {
    expect(isSupportedDailyDeskDate(value)).toBe(true);
  });

  it.each(["", "2026/03/26", "monday", "next month", "3 months ago", "2026-W1"])("rejects %s", (value) => {
    expect(isSupportedDailyDeskDate(value)).toBe(false);
  });
});
