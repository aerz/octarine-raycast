import { useState } from "react";
import { type DailySuggestion } from "../components/daily-desk/notes";
import { formatDateLabel, formatWeekLabel, type DateQuery } from "../lib/daily-desk";
import { findWorkspaceByName } from "../lib/workspaces";
import { ALL_WORKSPACES, type WorkspaceSection } from "../types/notes";
import type { Workspace } from "../types/octarine";
import { useDailyNotes } from "./useDailyNotes";
import { useLastWorkspace } from "./useLastWorkspace";
import { useOpenDailyNote } from "./useOpenDailyNote";
import { useWorkspaces } from "./useWorkspaces";

export type DailyDeskSuggestion = DailySuggestion & {
  sectionPath?: string;
};

export type DailyDeskSearchQuery = {
  date: DateQuery | null;
  suggestedDate?: string;
  hasExactMatch: boolean;
};

export type DailyDeskSearchWorkspace = {
  workspaces: Workspace[];
  isLoading: boolean;
  dropdown: string[];
  selected: string;
  grouped: boolean;
  target?: Workspace;
};

export type DailyDeskSearchResults = {
  visibleSections: WorkspaceSection[];
  hasNotes: boolean;
  suggestion?: DailyDeskSuggestion;
  suggestionInSection: boolean;
};

export type DailyDeskSearchActions = {
  onRefresh: () => void;
  onSearchTextChange: (value: string) => void;
  onWorkspaceChange: (value: string) => void;
  openDailyNote: (date: string, workspaceName: string) => Promise<void>;
  clearLastWorkspace: () => void | Promise<void>;
  rememberWorkspace: (workspaceName: string) => Promise<void>;
};

type Options = {
  requestedWorkspace: string;
  useLastWorkspaceEnabled: boolean;
};

type Result = {
  isLoading: boolean;
  query: DailyDeskSearchQuery;
  workspace: DailyDeskSearchWorkspace;
  results: DailyDeskSearchResults;
  actions: DailyDeskSearchActions;
};

export function useDailyDeskSearch({ requestedWorkspace, useLastWorkspaceEnabled }: Options): Result {
  const [refresh, setRefresh] = useState(false);
  const [searchText, setSearchText] = useState("");
  const { workspaces, status, revalidate: revalidateWorkspaces } = useWorkspaces({ refresh });
  const {
    workspace: lastWorkspace,
    isLoading: isLastWorkspaceLoading,
    remember: rememberWorkspace,
    clear: clearLastWorkspace,
  } = useLastWorkspace({
    workspaces,
    enabled: useLastWorkspaceEnabled,
  });
  const {
    dropdown,
    sections,
    isLoading,
    revalidate: revalidateNotes,
    hasNotes,
    dateQuery,
    suggestedDate,
    hasExactMatch,
    selectedWorkspace,
    setSelectedWorkspace,
  } = useDailyNotes({
    workspaces,
    enabled: !status.isLoading,
    requestedWorkspace,
    searchText,
    refresh,
  });
  const onRefresh = () => {
    if (!refresh) {
      setRefresh(true);
      return;
    }

    void revalidateWorkspaces();
    revalidateNotes();
  };
  const openDailyNote = useOpenDailyNote({
    date: "",
    requestedWorkspace,
    workspaces,
    status,
    onWorkspaceOpened: rememberWorkspace,
    enabled: false,
  });
  const grouped = selectedWorkspace === ALL_WORKSPACES;
  const selected = grouped ? undefined : findWorkspaceByName(workspaces, selectedWorkspace);
  const targetWorkspace = selected ?? (isLastWorkspaceLoading ? undefined : lastWorkspace);
  const suggestion: DailyDeskSuggestion | undefined =
    dateQuery && suggestedDate && !hasExactMatch
      ? {
          label: dateQuery.kind === "week" ? formatWeekLabel(suggestedDate) : formatDateLabel(suggestedDate),
          date: suggestedDate,
          target: targetWorkspace,
          locked: Boolean(selected),
          sectionPath: grouped ? targetWorkspace?.path : undefined,
        }
      : undefined;
  const visibleSections =
    suggestion && grouped && targetWorkspace && !sections.some((section) => section.path === targetWorkspace.path)
      ? [...sections, { name: targetWorkspace.name, path: targetWorkspace.path, notes: [] }].sort((a, b) =>
          a.name.localeCompare(b.name),
        )
      : sections;
  const suggestionInSection = Boolean(suggestion?.sectionPath);

  return {
    isLoading: isLoading || status.isLoading,
    query: {
      date: dateQuery,
      suggestedDate,
      hasExactMatch,
    },
    workspace: {
      workspaces,
      isLoading: status.isLoading,
      dropdown,
      selected: selectedWorkspace,
      grouped,
      target: targetWorkspace,
    },
    results: {
      visibleSections,
      hasNotes,
      suggestion,
      suggestionInSection,
    },
    actions: {
      onRefresh,
      onSearchTextChange: setSearchText,
      onWorkspaceChange: setSelectedWorkspace,
      openDailyNote,
      clearLastWorkspace,
      rememberWorkspace,
    },
  };
}
