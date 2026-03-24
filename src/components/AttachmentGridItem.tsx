import { Grid } from "@raycast/api";
import { AttachmentActions } from "./AttachmentActions";
import { type IndexedAttachment } from "../types/attachment";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

function getContent(file: IndexedAttachment): Grid.Item.Props["content"] {
  if (IMAGE_EXTENSIONS.has(file.extension)) {
    return file.path;
  }

  return { fileIcon: file.path };
}

type Props = {
  file: IndexedAttachment;
};

export function AttachmentGridItem({ file }: Props) {
  return (
    <Grid.Item
      title={file.name}
      subtitle={file.extension.toUpperCase()}
      content={getContent(file)}
      quickLook={{ name: file.name, path: file.path }}
      keywords={[file.workspace.name, file.extension]}
      actions={<AttachmentActions file={file} />}
    />
  );
}
