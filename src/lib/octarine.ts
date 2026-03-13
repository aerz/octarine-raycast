import { closeMainWindow, open, popToRoot } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export enum OctarineAction {
  Open = "open",
  Search = "search",
  Daily = "daily",
  Create = "create",
}

export enum OctarineParam {
  Path = "path",
  Query = "query",
  Date = "date",
  Workspace = "workspace",
}

type OctarinePosition = "top" | "bottom";

type OctarineWorkspaceParams = {
  workspace?: string;
};

type OctarineWriteParams = OctarineWorkspaceParams & {
  content?: string;
  template?: string;
  fresh?: boolean;
  position?: OctarinePosition;
  separator?: string;
  openAfter?: boolean;
};

type OctarineOpenUriRequest = OctarineWorkspaceParams & {
  action: OctarineAction.Open;
  path: string;
};

type OctarineSearchUriRequest = OctarineWorkspaceParams & {
  action: OctarineAction.Search;
  query: string;
};

type OctarineDailyUriRequest = OctarineWriteParams & {
  action: OctarineAction.Daily;
  date: string;
};

type OctarineCreateUriRequest = OctarineWriteParams & {
  action: OctarineAction.Create;
  path: string;
  contentReference?: string;
  compressedContent?: string;
};

type OctarineUriRequest =
  | OctarineOpenUriRequest
  | OctarineSearchUriRequest
  | OctarineDailyUriRequest
  | OctarineCreateUriRequest;

function appendParam(params: URLSearchParams, key: OctarineParam, value: string | boolean | undefined): void {
  if (value === undefined) {
    return;
  }

  params.append(key, typeof value === "boolean" ? String(value) : value);
}

export function buildOctarineUri(request: OctarineUriRequest): string {
  const params = new URLSearchParams();

  switch (request.action) {
    case OctarineAction.Open:
      appendParam(params, OctarineParam.Path, request.path);
      appendParam(params, OctarineParam.Workspace, request.workspace);
      break;
    case OctarineAction.Search:
      appendParam(params, OctarineParam.Query, request.query);
      appendParam(params, OctarineParam.Workspace, request.workspace);
      break;
    case OctarineAction.Daily:
      appendParam(params, OctarineParam.Date, request.date);
      appendParam(params, OctarineParam.Workspace, request.workspace);
      break;
    case OctarineAction.Create:
      appendParam(params, OctarineParam.Path, request.path);
      appendParam(params, OctarineParam.Workspace, request.workspace);
      break;
  }

  return `octarine://${request.action}?${params.toString()}`;
}

export function buildOpenWorkspaceFallbackUri(workspaceName: string): string {
  return buildOctarineUri({
    action: OctarineAction.Daily,
    date: "today",
    workspace: workspaceName,
  });
}

export async function openOctarineView(workspaceName: string, viewName: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Opening Octarine views is only supported on macOS.");
  }

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

  await open(buildOpenWorkspaceFallbackUri(workspaceName));
  await execFileAsync("osascript", ["-e", OPEN_VIEW_APPLE_SCRIPT, viewName]);
  await popToRoot({ clearSearchBar: true });
  await closeMainWindow({ clearRootSearch: true });
}
