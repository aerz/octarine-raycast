import { Detail } from "@raycast/api";
import { DAILY_DESK_DATE_FORMATS_MARKDOWN } from "../../lib/daily-desk";

export function DateFormatsDetail() {
  return <Detail markdown={DAILY_DESK_DATE_FORMATS_MARKDOWN} />;
}
