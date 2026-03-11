import { closeMainWindow, open, popToRoot } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export function buildOpenWorkspaceUri(workspaceName: string): string {
  return `octarine://open?workspace=${encodeURIComponent(workspaceName)}`;
}

export async function openOctarineView(workspaceName: string, viewName: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Opening Octarine views is only supported on macOS.");
  }

  await open(buildOpenWorkspaceUri(workspaceName));
  await execFileAsync("osascript", ["-e", OPEN_VIEW_APPLE_SCRIPT, viewName]);
  await popToRoot({ clearSearchBar: true });
  await closeMainWindow({ clearRootSearch: true });
}
