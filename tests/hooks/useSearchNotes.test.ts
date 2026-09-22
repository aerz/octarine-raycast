import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_WORKSPACES } from "@type/notes";

const { useContentSearch, useNotes, useWorkspaces, revalidateContent, revalidateNotes, matchOf, stateSetters } =
  vi.hoisted(() => ({
    useContentSearch: vi.fn(),
    useNotes: vi.fn(),
    useWorkspaces: vi.fn(),
    revalidateContent: vi.fn(),
    revalidateNotes: vi.fn(),
    matchOf: vi.fn(),
    stateSetters: [] as ReturnType<typeof vi.fn>[],
  }));

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => {
    const setter = vi.fn();
    stateSetters.push(setter);

    return [initial, setter];
  },
}));
vi.mock("@hooks/useWorkspaces", () => ({ useWorkspaces }));
vi.mock("@hooks/useContentSearch", () => ({ useContentSearch }));
vi.mock("@hooks/useNotes", () => ({ useNotes }));

import { useSearchNotes } from "@hooks/useSearchNotes";

type Options = {
  searchContent?: boolean;
  showPinnedNotesFirst?: boolean;
};

function renderSearchNotes({ searchContent = false, showPinnedNotesFirst = false }: Options = {}) {
  return useSearchNotes({ searchContent, showPinnedNotesFirst });
}

beforeEach(() => {
  vi.clearAllMocks();
  stateSetters.length = 0;
  useWorkspaces.mockReturnValue({ workspaces: [], status: { isLoading: false }, revalidate: vi.fn() });
  useContentSearch.mockReturnValue({ matches: new Map(), isLoading: false, revalidate: revalidateContent });
  useNotes.mockReturnValue({
    dropdown: ["Alpha"],
    sections: [],
    isLoading: false,
    revalidate: revalidateNotes,
    matchOf,
  });
});

describe("useSearchNotes", () => {
  it("enables content search from the preference", () => {
    const view = renderSearchNotes({ searchContent: true });

    expect(view.mode.contentEnabled).toBe(true);
    expect(useContentSearch).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, searchText: "" }));
  });

  it("passes the workspace filter and pinned preference to the notes hook", () => {
    renderSearchNotes({ showPinnedNotesFirst: true });

    expect(useNotes).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "all",
        searchText: "",
        selectedWorkspace: ALL_WORKSPACES,
        showPinnedNotesFirst: true,
        enabled: true,
      }),
    );
  });

  it("groups results when every workspace is selected", () => {
    const view = renderSearchNotes();

    expect(view.workspace.grouped).toBe(true);
  });

  it("exposes the note match resolver from the notes hook", () => {
    const view = renderSearchNotes();

    expect(view.results.matchOf).toBe(matchOf);
  });

  it("falls back to title and path search when content search fails", () => {
    renderSearchNotes({ searchContent: true });
    const { onError } = useContentSearch.mock.calls[0][0] as { onError: () => void };

    onError();

    expect(stateSetters[1]).toHaveBeenCalledWith(false);
  });

  it("revalidates content while refresh is unarmed", () => {
    const view = renderSearchNotes();

    view.actions.refresh();

    expect(revalidateContent).toHaveBeenCalled();
    expect(revalidateNotes).not.toHaveBeenCalled();
  });

  it("reports loading from notes or content search", () => {
    useContentSearch.mockReturnValue({ matches: new Map(), isLoading: true, revalidate: revalidateContent });

    expect(renderSearchNotes({ searchContent: true }).isLoading).toBe(true);
  });
});
