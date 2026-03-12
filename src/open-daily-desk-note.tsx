import { Action, ActionPanel, Detail, LaunchProps, Toast, open, popToRoot, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { useWorkspaceNotFound } from "./hooks/useWorkspaceNotFound";
import { loadWorkspaces } from "./lib/workspaces";
import type { Workspace } from "./types/octarine";

type OpenDailyDeskNoteArguments = {
  date: string;
  workspace?: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/i;
const NATURAL_EXACT_PATTERN = /^(today|yesterday|tomorrow)$/i;
const RELATIVE_PATTERN = /^(?:\d+\s+(?:day|days|week|weeks)\s+ago|in\s+\d+\s+(?:day|days|week|weeks))$/i;
const DAY_MODIFIER_PATTERN = /^(?:last|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
const WEEK_MODIFIER_PATTERN = /^(?:this|last|next)\s+week$/i;
const PARTIAL_DATE_PATTERN =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}$/i;

export function isSupportedDailyDeskDate(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return false;
  }

  return (
    ISO_DATE_PATTERN.test(normalized) ||
    ISO_WEEK_PATTERN.test(normalized) ||
    NATURAL_EXACT_PATTERN.test(normalized) ||
    RELATIVE_PATTERN.test(normalized) ||
    DAY_MODIFIER_PATTERN.test(normalized) ||
    WEEK_MODIFIER_PATTERN.test(normalized) ||
    PARTIAL_DATE_PATTERN.test(normalized)
  );
}

function buildDailyDeskUri(dateValue: string, workspaceName: string): string {
  return `octarine://daily?date=${encodeURIComponent(dateValue)}&workspace=${encodeURIComponent(workspaceName)}`;
}

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: OpenDailyDeskNoteArguments }>) {
  const requestedDate = props.arguments.date?.trim() ?? "";
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";
  const hasRequestedWorkspace = requestedWorkspace.length > 0;
  const isDateValid = useMemo(() => isSupportedDailyDeskDate(requestedDate), [requestedDate]);

  const [hasDirectOpenFailed, setHasDirectOpenFailed] = useState(false);
  const hasShownDateErrorToast = useRef(false);
  const hasAttemptedAutoOpen = useRef(false);

  const openDailyDeskNote = useCallback(
    async (workspaceName: string) => {
      try {
        await open(buildDailyDeskUri(requestedDate, workspaceName));
        await popToRoot({ clearSearchBar: true });
        return true;
      } catch {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Open Daily Desk Note",
        });
        return false;
      }
    },
    [requestedDate],
  );

  const {
    data: workspaceResult,
    error: workspaceLoadError,
    isLoading,
  } = usePromise(
    async () => {
      const result = await loadWorkspaces();

      if (!result.fromCache && result.invalidRoots.length > 0) {
        const noun = result.invalidRoots.length === 1 ? "root path" : "root paths";
        await showToast({
          style: Toast.Style.Failure,
          title: "Some workspace roots were skipped",
          message: `${result.invalidRoots.length} ${noun} could not be read.`,
        });
      }

      return result;
    },
    [],
    {
      execute: isDateValid,
      onError: async () => {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Load Workspaces",
        });
      },
    },
  );
  const workspaces = workspaceResult?.workspaces ?? [];
  const hasWorkspaceLoadFailed = Boolean(workspaceLoadError);

  const matchedWorkspace = useMemo(() => {
    if (!hasRequestedWorkspace) {
      return undefined;
    }

    return workspaces.find((workspace) => workspace.name === requestedWorkspace);
  }, [hasRequestedWorkspace, requestedWorkspace, workspaces]);

  const isWorkspaceNotFound = useWorkspaceNotFound({
    requestedWorkspace,
    hasRequestedWorkspace,
    isLoading,
    hasWorkspaceLoadFailed,
    matchedWorkspace,
    enabled: isDateValid,
  });

  useEffect(() => {
    if (isDateValid || hasShownDateErrorToast.current) {
      return;
    }

    hasShownDateErrorToast.current = true;
    void showToast({
      style: Toast.Style.Failure,
      title: "Invalid date",
      message: "Use a supported Octarine date format",
    });
  }, [isDateValid]);

  useEffect(() => {
    if (!isDateValid || !matchedWorkspace || hasAttemptedAutoOpen.current) {
      return;
    }

    hasAttemptedAutoOpen.current = true;
    void (async () => {
      const didOpen = await openDailyDeskNote(matchedWorkspace.name);

      if (!didOpen) {
        setHasDirectOpenFailed(true);
      }
    })();
  }, [isDateValid, matchedWorkspace, openDailyDeskNote]);

  useEffect(() => {
    hasAttemptedAutoOpen.current = false;
    setHasDirectOpenFailed(false);
  }, [requestedWorkspace, requestedDate]);

  if (!isDateValid) {
    const markdown = [
      "# Invalid Date",
      "",
      "**Supported Date Formats**",
      "",
      "- ISO date: `2024-01-15`, `2024-12-25`",
      "- ISO week: `2024-W03`, `2026-W01`",
      "- Natural language dates: `today`, `yesterday`, `tomorrow`",
      "- Relative dates: `2 days ago`, `next monday`, `last friday`",
      "- Partial dates: `jan 15`, `december 25`, `nov 3`",
      "- Natural language weeks: `this week`, `last week`, `next week`",
      "- Relative weeks: `2 weeks ago`, `in 2 weeks`",
    ].join("\n");

    return <Detail markdown={markdown} />;
  }

  if (hasRequestedWorkspace && matchedWorkspace && !hasDirectOpenFailed && !isWorkspaceNotFound) {
    return null;
  }

  const workspaceMenu = (
    <WorkspaceMenu
      isLoading={isLoading}
      workspaces={workspaces}
      searchBarPlaceholder="Select an Octarine workspace..."
      renderActions={(workspace: Workspace) => (
        <ActionPanel>
          <Action title="Open Daily Desk Note" onAction={() => void openDailyDeskNote(workspace.name)} />
        </ActionPanel>
      )}
    />
  );

  return workspaceMenu;
}
