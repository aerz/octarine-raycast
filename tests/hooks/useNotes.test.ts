import { beforeEach, describe, expect, it, vi } from "vitest";
import { setMockPreferences } from "../__mocks__/@raycast/api";
import { ALL_WORKSPACES, type IndexedNote } from "@type/notes";
import type { Workspace } from "@type/octarine";

const { getNotes, useCachedPromise } = vi.hoisted(() => ({
  getNotes: vi.fn(),
  useCachedPromise: vi.fn(),
}));

vi.mock("@raycast/utils", () => ({ useCachedPromise }));
vi.mock("@lib/notes", () => ({ getNotes }));
vi.mock("react", () => ({ useMemo: (factory: () => unknown) => factory() }));

import { useNotes } from "@hooks/useNotes";

const alpha = { name: "Alpha", path: "/tmp/alpha" };
const beta = { name: "Beta", path: "/tmp/beta" };

function note(workspace: Workspace, title: string, options?: { pinned?: boolean }): IndexedNote {
  const notePath = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;

  return {
    id: `${workspace.path}::${notePath}`,
    title,
    path: notePath,
    folder: { name: "", path: "", workspace },
    pinned: options?.pinned ?? false,
    searchText: `${title} ${workspace.name}`.toLowerCase(),
  };
}

function renderNotes(notes: IndexedNote[], options?: Partial<Parameters<typeof useNotes>[0]>) {
  useCachedPromise.mockReturnValue({
    data: notes,
    isLoading: false,
    revalidate: vi.fn(),
  });

  return useNotes({
    workspaces: [alpha, beta],
    searchText: "",
    selectedWorkspace: ALL_WORKSPACES,
    ...options,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getNotes.mockResolvedValue([]);
});

describe("useNotes", () => {
  it("loads general notes with excluded directories in its cache key", async () => {
    setMockPreferences({ excludedFoldersInWorkspaces: "Templates, Archive" });

    renderNotes([]);
    const load = useCachedPromise.mock.calls[0][0];

    expect(useCachedPromise.mock.calls[0][1]).toEqual([false, [alpha, beta], '["archive","templates"]']);

    await load(false, [alpha, beta], '["archive","templates"]');

    expect(getNotes).toHaveBeenCalledWith([alpha, beta], new Set(["archive", "templates"]), { refresh: false });
  });

  it("groups notes by workspace and sorts sections by name", () => {
    const result = renderNotes([note(beta, "Beta note"), note(alpha, "Alpha note")]);

    expect(result.sections.map((section) => section.name)).toEqual(["Alpha", "Beta"]);
    expect(result.sections[0].notes.map((item) => item.title)).toEqual(["Alpha note"]);
  });

  it("builds a unique workspace dropdown", () => {
    const duplicate = { name: "Alpha", path: "/tmp/alpha-2" };
    const result = renderNotes([note(alpha, "Alpha note"), note(duplicate, "Other")]);

    expect(result.dropdown).toEqual(["Alpha"]);
  });

  it("filters by workspace and drops empty sections", () => {
    const result = renderNotes([note(alpha, "Alpha note"), note(beta, "Beta note")], {
      selectedWorkspace: "Beta",
    });

    expect(result.sections.map((section) => section.name)).toEqual(["Beta"]);
  });

  it("keeps every workspace when all workspaces are selected", () => {
    const result = renderNotes([note(alpha, "Alpha note"), note(beta, "Beta note")]);

    expect(result.sections.map((section) => section.name)).toEqual(["Alpha", "Beta"]);
  });

  it("applies the pinned scope and matcher", () => {
    const notes = [
      note(alpha, "Alpha regular"),
      note(alpha, "Alpha pinned", { pinned: true }),
      note(beta, "Beta regular"),
    ];
    const pinned = renderNotes(notes, { scope: "pinned" });
    const matched = renderNotes(notes, { searchText: "beta" });

    expect(pinned.sections.flatMap((section) => section.notes.map((item) => item.title))).toEqual(["Alpha pinned"]);
    expect(matched.sections.map((section) => section.name)).toEqual(["Beta"]);
  });

  it("sorts pinned notes first only when requested", () => {
    const notes = [note(alpha, "Alpha regular"), note(alpha, "Alpha pinned", { pinned: true })];
    const sorted = renderNotes(notes, { selectedWorkspace: "Alpha", showPinnedNotesFirst: true });
    const unsorted = renderNotes(notes, { selectedWorkspace: "Alpha" });

    expect(sorted.sections[0].notes.map((item) => item.title)).toEqual(["Alpha pinned", "Alpha regular"]);
    expect(unsorted.sections[0].notes.map((item) => item.title)).toEqual(["Alpha regular", "Alpha pinned"]);
  });
});
