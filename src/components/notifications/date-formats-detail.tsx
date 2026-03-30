import { Detail } from "@raycast/api";

export function DateFormatsDetail() {
  return (
    <Detail
      markdown={[
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
      ].join("\n")}
    />
  );
}
