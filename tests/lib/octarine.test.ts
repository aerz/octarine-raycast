import { closeMainWindow, open, popToRoot } from "@raycast/api";
import { compressToBase64 } from "lz-string";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() =>
  vi.fn((_file: string, _args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) =>
    callback(null, "", ""),
  ),
);

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  appendDailyNoteContent,
  appendNoteContent,
  openAttachment,
  openDailyDeskNote,
  openNote,
  openView,
} from "../../src/lib/octarine";

function parseUri(uri: string) {
  const [schemeAndAction, query = ""] = uri.split("?");

  return {
    action: schemeAndAction.replace("octarine://", ""),
    params: new URLSearchParams(query),
  };
}

function getOpenedUri(): ReturnType<typeof parseUri> {
  const [[uri]] = vi.mocked(open).mock.calls;
  return parseUri(uri);
}

beforeEach(() => {
  execFileMock.mockClear();
});

describe("octarine", () => {
  it("opens note URIs and closes Raycast", async () => {
    await openNote("docs/plan.md", "Work");
    const parsed = getOpenedUri();

    expect(parsed.action).toBe("open");
    expect(parsed.params.get("path")).toBe("docs/plan.md");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(popToRoot).toHaveBeenCalledWith({ clearSearchBar: true });
    expect(closeMainWindow).toHaveBeenCalledWith({ clearRootSearch: true });
  });

  it("opens attachment search URIs", async () => {
    await openAttachment("team standup", "Work");
    const parsed = getOpenedUri();

    expect(parsed.action).toBe("search");
    expect(parsed.params.get("query")).toBe("team standup");
    expect(parsed.params.get("workspace")).toBe("Work");
  });

  it("opens daily desk note URIs", async () => {
    await openDailyDeskNote("2026-03-26", "Work");
    const parsed = getOpenedUri();

    expect(parsed.action).toBe("daily");
    expect(parsed.params.get("date")).toBe("2026-03-26");
    expect(parsed.params.get("workspace")).toBe("Work");
  });

  it("builds create URIs when appending note content", async () => {
    await appendNoteContent({
      path: "docs/plan.md",
      workspace: "Work",
      content: "Hello",
    });
    const parsed = getOpenedUri();

    expect(parsed.action).toBe("create");
    expect(parsed.params.get("path")).toBe("docs/plan.md");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(parsed.params.get("compressedContent")).toBe(compressToBase64("Hello"));
    expect(parsed.params.get("position")).toBe("bottom");
    expect(parsed.params.get("separator")).toBe("\n\n");
    expect(parsed.params.get("openAfter")).toBe("true");
  });

  it("builds daily URIs when appending daily note content", async () => {
    await appendDailyNoteContent({
      date: "2026-03-26",
      workspace: "Work",
      content: "Hello",
    });
    const parsed = getOpenedUri();

    expect(parsed.action).toBe("daily");
    expect(parsed.params.get("date")).toBe("2026-03-26");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(parsed.params.get("content")).toBe("Hello");
  });

  it("opens a workspace and runs AppleScript when opening a view", async () => {
    await openView("Work", "Inbox");
    const parsed = getOpenedUri();
    const openMock = vi.mocked(open);
    const popToRootMock = vi.mocked(popToRoot);

    expect(parsed.action).toBe("daily");
    expect(parsed.params.get("date")).toBe("today");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(execFileMock).toHaveBeenCalledWith(
      "osascript",
      ["-e", expect.stringContaining('tell application "Octarine"'), "Inbox"],
      expect.any(Function),
    );
    expect(openMock.mock.invocationCallOrder[0]).toBeLessThan(execFileMock.mock.invocationCallOrder[0]);
    expect(execFileMock.mock.invocationCallOrder[0]).toBeLessThan(popToRootMock.mock.invocationCallOrder[0]);
    expect(popToRoot).toHaveBeenCalledWith({ clearSearchBar: true });
    expect(closeMainWindow).toHaveBeenCalledWith({ clearRootSearch: true });
  });
});
