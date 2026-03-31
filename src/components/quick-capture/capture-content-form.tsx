import { Action, ActionPanel, Form } from "@raycast/api";
import { type IndexedNote } from "../../lib/notes";
import { isSupportedDate } from "../../lib/daily-desk";
import { appendDailyNoteContent, appendNoteContent } from "../../lib/octarine";
import { isEmptyAppendContent, showCaptureFailureToast } from "./shared";
import { DateFormatsDetail } from "../notifications/date-formats";

type CaptureContentFormProps =
  | {
      note: IndexedNote;
    }
  | {
      workspace: string;
      date: string;
      title: string;
    };

type AppendFormValues = {
  content: string;
};

type AppendTargetConfig = {
  navigationTitle: string;
  submitTitle: string;
  description: string;
  placeholder: string;
  append: (content: string) => Promise<void>;
};

export function CaptureContentForm(props: CaptureContentFormProps) {
  const target = getAppendTargetConfig(props);

  if (!target) {
    return <DateFormatsDetail />;
  }

  const { append, description, navigationTitle, placeholder, submitTitle } = target;

  async function handleSubmit(values: AppendFormValues) {
    if (isEmptyAppendContent(values)) {
      await showCaptureFailureToast("Nothing to Append", "Enter some text before submitting.");
      return;
    }

    try {
      await append(values.content);
    } catch (error) {
      await showCaptureFailureToast(
        "Failed to Append Content",
        error instanceof Error ? error.message : "Try again.",
      );
    }
  }

  return (
    <Form
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={submitTitle} onSubmit={(values: AppendFormValues) => void handleSubmit(values)} />
        </ActionPanel>
      }
    >
      <Form.Description text={description} />
      <Form.TextArea id="content" title="Content" placeholder={placeholder} />
    </Form>
  );
}

function getAppendTargetConfig(props: CaptureContentFormProps): AppendTargetConfig | null {
  if ("note" in props) {
    return {
      navigationTitle: `Append to ${props.note.title}`,
      submitTitle: "Append to Note",
      description: `${props.note.workspace.name} / ${props.note.path}`,
      placeholder: "Write something to append to this note...",
      append: async (content) =>
        appendNoteContent({
          path: props.note.path,
          workspace: props.note.workspace.name,
          content,
        }),
    };
  }

  if (!isSupportedDate(props.date)) {
    return null;
  }

  return {
    navigationTitle: `Append to ${props.title}`,
    submitTitle: `Append to ${props.title}`,
    description: `${props.workspace} / ${props.title}`,
    placeholder: `Write something to append to ${props.title.toLowerCase()}...`,
    append: async (content) =>
      appendDailyNoteContent({
        workspace: props.workspace,
        date: props.date,
        content,
      }),
  };
}
