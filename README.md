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

## Open Workspace

Displays a list of your workspaces. Press `Enter` to open the selected one.

**Arguments**

- **Workspace** *(optional)*. Type a workspace name to open it directly, skipping manual selection.

## Open Today's Note

Opens today's note from Daily Desk.

**Arguments**

- **Workspace** *(optional)*. The workspace to open today's note in. Overrides the default workspace.

**Preferences**

- **Default Workspace**. The workspace used when no argument is provided. If unset, a workspace selector will appear.

## Open Daily Desk Note

Open a note with any date from Daily Desk.

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
