import { Action, ActionPanel, Form } from "@raycast/api";
import { type IndexedNote } from "../../lib/notes";
import { isSupportedDate } from "../../lib/daily-desk";
import {
  appendContentToDailyTarget,
  appendContentToNote,
  isEmptyAppendContent,
  showCaptureFailureToast,
} from "./shared";
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

    await append(values.content);
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
      append: async (content) => appendContentToNote(props.note, content, "Appending to Note…", "Content Appended"),
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
      appendContentToDailyTarget(
        props.workspace,
        props.date,
        content,
        `Appending to ${props.title}…`,
        `Content Appended to ${props.title}`,
      ),
  };
}
