import { closeMainWindow, open, popToRoot } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

enum Action {
  Open = "open",
  Search = "search",
  Daily = "daily",
}

type OpenScheme = {
  action: Action.Open;
  workspace?: string;
  path: string;
};

type SearchScheme = {
  action: Action.Search;
  workspace?: string;
  query: string;
};

type DailyScheme = {
  action: Action.Daily;
  workspace?: string;
  date: string;
};

type Scheme = OpenScheme | SearchScheme | DailyScheme;

export function openWorkspace(name: string): Promise<void> {
  return openUri(buildOpenWorkspaceUri(name));
}

export function openAttachment(name: string, workspace?: string): Promise<void> {
  const uri = buildUri({
    action: Action.Search,
    query: name,
    workspace,
  });
  return openUri(uri);
}

export function openNote(path: string, workspace?: string): Promise<void> {
  const uri = buildUri({
    action: Action.Open,
    path,
    workspace,
  });
  return openUri(uri);
}

export function openPinnedNote(path: string, workspace?: string): Promise<void> {
  return openNote(path, workspace);
}

export function openDailyDeskNote(date: string, workspace: string): Promise<void> {
  return openUri(
    buildUri({
      action: Action.Daily,
      date,
      workspace,
    }),
  );
}

export function openTodayNote(workspace: string): Promise<void> {
  return openDailyDeskNote("today", workspace);
}

export async function openView(workspace: string, view: string): Promise<void> {
  const execAsync = promisify(execFile);
  const OPEN_VIEW_APPLE_SCRIPT = `
  on run argv
    set targetViewName to item 1 of argv

    tell application "Octarine"
      activate
    end tell

    tell application "System Events"
      tell process "Octarine"
        repeat until frontmost
          delay 0.05
        end repeat
        delay 0.5

        keystroke "k" using command down
        delay 0.5

        keystroke "View " & targetViewName
        delay 0.5
        keystroke return
      end tell
    end tell
  end run
  `;

  await open(buildOpenWorkspaceUri(workspace));
  await execAsync("osascript", ["-e", OPEN_VIEW_APPLE_SCRIPT, view]);
  await popToRoot({ clearSearchBar: true });
  await closeMainWindow({ clearRootSearch: true });
}

async function openUri(uri: string): Promise<void> {
  await open(uri);
  await popToRoot({ clearSearchBar: true });
  await closeMainWindow({ clearRootSearch: true });
}

function buildOpenWorkspaceUri(workspace: string): string {
  return buildUri({
    action: Action.Daily,
    date: "today",
    workspace,
  });
}

function buildUri({ action, ...params }: Scheme): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)]);

  const query = new URLSearchParams(Object.fromEntries(entries)).toString();
  return `octarine://${action}${query ? `?${query}` : ""}`;
}
