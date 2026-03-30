import { Toast, showToast } from "@raycast/api";

export async function skippedRootsToast(count: number): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: "Some workspace roots were skipped",
    message: `${count} workspace roots could not be read.`,
  });
}

export async function viewsLoadToast(): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: "Failed to Scan Views",
  });
}
