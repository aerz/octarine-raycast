<p align="center">
  <img width=180 src="./assets/icon.png">
</p>

# Octarine for Raycast

Control [Octarine](https://octarine.app) directly from Raycast with a curated set of commands designed to streamline your workflow.

Install the extension from the Raycast Store, configure one or more workspace locations, and use the ready-to-use commands below to access your personal notes faster.

## Overview

- [Open Workspace](#open-workspace)
- [Open Daily Desk Note](#open-daily-desk-note)
- [Search Notes](#search-notes)
- [Search Attachments](#search-attachments)

## Open Workspace

Browse and open any of your [workspaces](https://docs.octarine.app/core-concepts/workspaces) with a single keystroke.

**Arguments**

- **Workspace** *(optional)*. Type a workspace name to open it directly, skipping manual selection.

## Open Daily Desk Note

Browse or open any [Daily Desk](https://docs.octarine.app/daily-desk/) note. Type a date in natural language to open it instantly, or run the command with no arguments to browse every note in the `Daily` folder of each workspace.

**Arguments**

- **Date** *(optional)*. Use a smart date format to open a specific date (see formats below). The date is normalized, so `22 Dec, 2026` opens the `2026-12-22` note.
- **Workspace** *(optional)*. The workspace name to open the daily desk note in.

When no date is provided, the command lists all daily and weekly notes across workspaces, grouped into sections and ordered from newest to oldest. Use the dropdown to filter by workspace, or type a date to jump to a note. Typing a date makes fuzzy results available, so `feb 2` also shows notes from February 20-29, while exact date matches are listed before fuzzy ones.

**Opening a Missing Date**

While typing a supported date, an **Open [date]** item is placed as the first item of its workspace section (the last used workspace, or **No Workspace**), without duplicating the section. If that workspace has no other results, the item gets its own section. Pressing `Enter` validates the date and opens a workspace selector; picking a workspace creates or opens that note in Octarine.

When **Use Last Workspace** is enabled and a workspace was used before, the section shows that workspace name and `Enter` opens the note there directly. Use **Choose Workspace…** to pick another one, or **Clear Last Workspace** to forget it. If the workspace dropdown is filtering by a specific workspace, the suggestion always opens the note in that workspace.

**Preferences**

- **Default Workspace**. The workspace used when a date is provided without a workspace argument. If unset, a workspace selector will appear.
- **Show Filename**. Shows file names such as `2023-02-18` instead of natural language dates like `February 18, 2023`.
- **Use Last Workspace**. Remembers the last workspace used and opens suggested dates there instead of asking every time.

**Supported Date Formats**

| Format                 | Examples                                   |
|------------------------|--------------------------------------------|
| ISO date               | `2024-01-15`, `2024-12-25`                 |
| ISO week               | `2024-W03`, `2026-W01`                     |
| Natural language       | `today`, `yesterday`, `tomorrow`           |
| Relative dates         | `2 days ago`, `next monday`, `last friday` |
| Partial dates          | `jan 15`, `december 25`, `nov 3`           |
| Full dates             | `jan 15 2026`, `22 Dec, 2026`              |
| Natural language weeks | `this week`, `last week`, `next week`      |
| Relative weeks         | `2 weeks ago`, `in 2 weeks`                |

**References**

- [Daily Desk / Smart Dates](https://docs.octarine.app/daily-desk/smart-dates)
- [`daily` — Open a daily or weekly note](https://docs.octarine.app/workflows/uri-scheme#daily---open-a-daily-or-weekly-note)

## Search Notes

Search and open your Octarine notes from anywhere on your computer. Instantly filter across all configured workspaces by note name, folder, or workspace — without leaving your current context.

**Search & Filter**

- Queries are fuzzy by default for broader matches. To scope results to a specific folder, append a trailing slash to the folder name (e.g. articles/).
- Use the dropdown to filter by workspace.
- Open Actions (`⌘ K`) and select **Show Pinned Notes Only** to show only [pinned notes](https://docs.octarine.app/note-management/pinned) across all workspaces or within the selected workspace. Select **Show All Notes** to remove the filter.
- Open Actions and select **Search Note Contents** (`⌘ ⇧ F`) to include note content for the current search. Content-only matches show a contextual excerpt; select **Search Titles and Paths Only** to return to the default mode.

**Preferences**

- **Show workspace note count**. Displays a note counter for each workspace section.
- **Show Pinned Notes First**. Sorts pinned notes to the top of each workspace list.
- **Search Content**. Includes note content in searches by default. This can still be toggled for the current session from Actions.

## Search Attachments

Browse all [files attached](https://docs.octarine.app/editor/attachments) to notes across your workspaces. Search, preview, and open attachments from a visual grid.

**Actions**

| Shortcut  | Action                        |
|-----------|-------------------------------|
| `Enter`   | Search References in Octarine |
| `⌘ Enter` | Open File                     |
| `Space`   | Toggle Quick Look             |
| `⌘ .`     | Copy File Path                |

**Search & Filter**

Type to filter by filename or extension. Use the dropdown to narrow results by file type.

**Preferences**

- **Show attachment count**. Display the number of attachments per workspace in parentheses.
- **Flatten workspace sections**. Show all attachments in a single alphabetically sorted list.
- **Exclude file extensions**. Comma-separated list of file extensions to omit from results.
