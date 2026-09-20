import { closeMainWindow, open, popToRoot } from "@raycast/api";
import { describe, expect, it, vi } from "vitest";
import { openAttachment, openDailyDeskNote, openNote } from "../../src/lib/octarine";

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
});
