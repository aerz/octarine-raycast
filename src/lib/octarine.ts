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
  Content = "content",
  Template = "template",
  Fresh = "fresh",
  Position = "position",
  Separator = "separator",
  OpenAfter = "openAfter",
  ContentReference = "contentReference",
  CompressedContent = "compressedContent",
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

function buildOctarineUri(request: OctarineUriRequest): string {
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
      appendParam(params, OctarineParam.Content, request.content);
      appendParam(params, OctarineParam.Template, request.template);
      appendParam(params, OctarineParam.Fresh, request.fresh);
      appendParam(params, OctarineParam.Position, request.position);
      appendParam(params, OctarineParam.Separator, request.separator);
      appendParam(params, OctarineParam.OpenAfter, request.openAfter);
      break;
    case OctarineAction.Create:
      appendParam(params, OctarineParam.Path, request.path);
      appendParam(params, OctarineParam.Workspace, request.workspace);
      appendParam(params, OctarineParam.Content, request.content);
      appendParam(params, OctarineParam.Template, request.template);
      appendParam(params, OctarineParam.Fresh, request.fresh);
      appendParam(params, OctarineParam.Position, request.position);
      appendParam(params, OctarineParam.Separator, request.separator);
      appendParam(params, OctarineParam.OpenAfter, request.openAfter);
      appendParam(params, OctarineParam.ContentReference, request.contentReference);
      appendParam(params, OctarineParam.CompressedContent, request.compressedContent);
      break;
  }

  return `octarine://${request.action}?${params.toString()}`;
}

export function buildOpenNoteUri(path: string, workspaceName?: string): string {
  return buildOctarineUri({
    action: OctarineAction.Open,
    path,
    workspace: workspaceName,
  });
}

export function buildSearchUri(query: string, workspaceName?: string): string {
  return buildOctarineUri({
    action: OctarineAction.Search,
    query,
    workspace: workspaceName,
  });
}

export function buildDailyNoteUri(date: string, workspaceName?: string): string {
  return buildOctarineUri({
    action: OctarineAction.Daily,
    date,
    workspace: workspaceName,
  });
}

export function buildOpenWorkspaceUri(workspaceName: string): string {
  return buildDailyNoteUri("today", workspaceName);
}

export function buildCreateNoteUri(path: string, workspaceName?: string): string {
  return buildOctarineUri({
    action: OctarineAction.Create,
    path,
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

  await open(buildOpenWorkspaceUri(workspaceName));
  await execFileAsync("osascript", ["-e", OPEN_VIEW_APPLE_SCRIPT, viewName]);
  await popToRoot({ clearSearchBar: true });
  await closeMainWindow({ clearRootSearch: true });
}
