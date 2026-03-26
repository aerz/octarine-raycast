import { Action, ActionPanel, Form } from "@raycast/api";
import { type IndexedNote } from "../../lib/notes";
import { isSupportedDailyDeskDate } from "../../lib/daily-desk";
import {
  appendContentToDailyTarget,
  appendContentToNote,
  InvalidDailyDeskDateView,
  isEmptyAppendContent,
  showCaptureFailureToast,
} from "./shared";

type AppendContentFormProps =
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

export function AppendContentForm(props: AppendContentFormProps) {
  if ("note" in props) {
    const noteTarget = props;

    async function handleSubmit(values: AppendFormValues) {
      if (isEmptyAppendContent(values)) {
        await showCaptureFailureToast("Nothing to Append", "Enter some text before submitting.");
        return;
      }

      await appendContentToNote(noteTarget.note, values.content, "Appending to Note…", "Content Appended");
    }

    return (
      <Form
        navigationTitle={`Append to ${noteTarget.note.title}`}
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Append to Note"
              onSubmit={(values: AppendFormValues) => void handleSubmit(values)}
            />
          </ActionPanel>
        }
      >
        <Form.Description text={`${noteTarget.note.workspace.name} / ${noteTarget.note.path}`} />
        <Form.TextArea id="content" title="Content" placeholder="Write something to append to this note..." />
      </Form>
    );
  }

  const dailyDeskTarget = props;

  if (!isSupportedDailyDeskDate(dailyDeskTarget.date)) {
    return <InvalidDailyDeskDateView />;
  }

  async function handleSubmit(values: AppendFormValues) {
    if (isEmptyAppendContent(values)) {
      await showCaptureFailureToast("Nothing to Append", "Enter some text before submitting.");
      return;
    }

    await appendContentToDailyTarget(
      dailyDeskTarget.workspace,
      dailyDeskTarget.date,
      values.content,
      `Appending to ${dailyDeskTarget.title}…`,
      `Content Appended to ${dailyDeskTarget.title}`,
    );
  }

  return (
    <Form
      navigationTitle={`Append to ${dailyDeskTarget.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={`Append to ${dailyDeskTarget.title}`}
            onSubmit={(values: AppendFormValues) => void handleSubmit(values)}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={`${dailyDeskTarget.workspace} / ${dailyDeskTarget.title}`} />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder={`Write something to append to ${dailyDeskTarget.title.toLowerCase()}...`}
      />
    </Form>
  );
}
