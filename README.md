<p align="center">
  <img width=180 src="./assets/extension-icon.png">
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
- [Search Pinned Notes](#search-pinned-notes)
- [Search Views](#search-views)
- [Quick Capture](#quick-capture)
  - [Capture Website](#capture-website)
  - [Capture Clipboard](#capture-clipboard)
  - [Capture Selected Text](#capture-selected-text)
  - [Capture Content](#capture-content)

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

## Search Pinned Notes

Search [pinned notes](https://docs.octarine.app/note-management/pinned) across all workspaces by title.

**Search & Filter**

Use the dropdown to filter by workspace.

**Preferences**

- **Show workspace note count**. Display the number of pinned notes per workspace in parentheses.

## Search Views

Search and open any [view](https://docs.octarine.app/organization/views) across all your workspaces. Filter by workspace or search by title to get to the right view instantly.

> [!WARNING]
> Requires AppleScript to open views in Octarine. May fail until a native implementation via
> Octarine's URI scheme is available.

**Preferences**

- **Show workspace view count**. Show a view counter for each workspace section.

## Quick Capture

Capture content into your Octarine notes from anywhere, using Raycast's capabilities in a variety of ways.

### Capture Website

Requires the [Raycast browser extension](https://www.raycast.com/browser-extension). Captures the full content of the active browser tab and saves it as a new note in Markdown.

### Capture Clipboard

Appends whatever is in your clipboard directly to a note of your choice. Ideal for quickly saving links or snippets without leaving Raycast.

### Capture Selected Text

Select any text in any app, then run this command to save it to a note of your choice.

### Capture Content

Select a note, type your content into the form, and save. You can close and reopen the form while drafting — your input is preserved until you're ready.
