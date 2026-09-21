import type { LaunchProps } from "@raycast/api";
import { DailyDeskOpen } from "./components/daily-desk/open";
import { DailyDeskSearch } from "./components/daily-desk/search";
import { DateFormatsDetail } from "./components/notifications/date-formats";
import { resolveDateArg } from "./lib/daily-desk";

type Arguments = {
  date?: string;
  workspace?: string;
};

export default function OpenDailyDeskNoteCommand(props: LaunchProps<{ arguments: Arguments }>) {
  const requestedDate = resolveDateArg(props.arguments.date);
  const requestedWorkspace = props.arguments.workspace?.trim() ?? "";

  if (requestedDate === null) {
    return <DateFormatsDetail />;
  }

  if (requestedDate !== "") {
    return <DailyDeskOpen date={requestedDate} requestedWorkspace={requestedWorkspace} />;
  }

  return <DailyDeskSearch requestedWorkspace={requestedWorkspace} />;
}
