<p align="center">
  <img width=180 src="./assets/icon.png">
</p>

# Octarine for Raycast

Control [Octarine](https://octarine.app) directly from Raycast with a curated set of commands designed to streamline your workflow.

Install the extension from the Raycast Store, configure one or more workspace locations, and use the ready-to-use commands below to access your personal notes faster.

## Overview

- [Open Workspace](#open-workspace)
- [Open Today's Note](#open-todays-note)
- [Open Daily Desk Note](#open-daily-desk-note)
- [Search Notes](#search-notes)
- [Search Attachments](#search-attachments)

## Open Workspace

Browse and open any of your [workspaces](https://docs.octarine.app/core-concepts/workspaces) with a single keystroke.

**Arguments**

- **Workspace** *(optional)*. Type a workspace name to open it directly, skipping manual selection.

## Open Today's Note

Opens today's Daily Desk note instantly, switching to the right workspace automatically.

**Arguments**

- **Workspace** *(optional)*. The workspace to open today's note in. Overrides the default workspace.

**Preferences**

- **Default Workspace**. The workspace used when no argument is provided. If unset, a workspace selector will appear.

## Open Daily Desk Note

Open any [Daily Desk](https://docs.octarine.app/daily-desk/) note by typing a date in natural language. The command switches to the right workspace automatically, and if it can't find it, a selector lets you pick from all available ones.

**Arguments**

- **Date**. Use a smart date format to provide a date (see formats below).
- **Workspace** *(optional)*. The workspace name to open the daily desk note in.

**Supported Date Formats**

| Format                 | Examples                                   |
|------------------------|--------------------------------------------|
| ISO date               | `2024-01-15`, `2024-12-25`                 |
| ISO week               | `2024-W03`, `2026-W01`                     |
| Natural language       | `today`, `yesterday`, `tomorrow`           |
| Relative dates         | `2 days ago`, `next monday`, `last friday` |
| Partial dates          | `jan 15`, `december 25`, `nov 3`           |
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

**Preferences**

- **Show workspace note count**. Displays a note counter for each workspace section.
- **Show Pinned Notes First**. Sorts pinned notes to the top of each workspace list.

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
