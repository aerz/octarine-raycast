import { Toast, closeMainWindow, open, popToRoot, showToast } from "@raycast/api";
import { describe, expect, it, vi } from "vitest";
import { buildCreateNoteUri, buildDailyNoteUri, buildSearchUri, openOctarineUri } from "../../src/lib/octarine";

function parseUri(uri: string) {
  const [schemeAndAction, query = ""] = uri.split("?");

  return {
    action: schemeAndAction.replace("octarine://", ""),
    params: new URLSearchParams(query),
  };
}

describe("octarine URIs", () => {
  it("builds search URIs", () => {
    expect(buildSearchUri("team standup", "Work")).toBe("octarine://search?query=team+standup&workspace=Work");
  });

  it("builds daily note URIs with optional parameters", () => {
    const uri = buildDailyNoteUri("2026-03-26", {
      workspaceName: "Work",
      content: "Hello",
      openAfter: false,
      position: "top",
      separator: "\n--\n",
    });
    const parsed = parseUri(uri);

    expect(parsed.action).toBe("daily");
    expect(parsed.params.get("date")).toBe("2026-03-26");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(parsed.params.get("content")).toBe("Hello");
    expect(parsed.params.get("openAfter")).toBe("false");
    expect(parsed.params.get("position")).toBe("top");
    expect(parsed.params.get("separator")).toBe("\n--\n");
  });

  it("builds create note URIs with content references", () => {
    const uri = buildCreateNoteUri("docs/plan.md", {
      workspaceName: "Work",
      contentReference: "clipboard",
      compressedContent: "abc123",
      fresh: true,
    });
    const parsed = parseUri(uri);

    expect(parsed.action).toBe("create");
    expect(parsed.params.get("path")).toBe("docs/plan.md");
    expect(parsed.params.get("workspace")).toBe("Work");
    expect(parsed.params.get("contentReference")).toBe("clipboard");
    expect(parsed.params.get("compressedContent")).toBe("abc123");
    expect(parsed.params.get("fresh")).toBe("true");
  });
});

describe("openOctarineUri", () => {
  it("opens the URI and closes Raycast on success", async () => {
    const result = await openOctarineUri("octarine://search?query=test");

    expect(result).toBe(true);
    expect(open).toHaveBeenCalledWith("octarine://search?query=test");
    expect(popToRoot).toHaveBeenCalledWith({ clearSearchBar: true });
    expect(closeMainWindow).toHaveBeenCalledWith({ clearRootSearch: true });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows a failure toast when opening fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    open.mockRejectedValueOnce(new Error("boom"));

    const result = await openOctarineUri("octarine://search?query=test");

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to open Octarine URI", {
      uri: "octarine://search?query=test",
      error: expect.any(Error),
    });
    expect(showToast).toHaveBeenCalledWith({
      style: Toast.Style.Failure,
      title: "Failed to Open in Octarine",
      message: undefined,
    });
  });
});
