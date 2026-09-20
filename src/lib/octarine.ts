import { closeMainWindow, open, popToRoot } from "@raycast/api";

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
