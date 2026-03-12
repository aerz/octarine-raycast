type UnknownRecord = Record<string, unknown>;

export type Workspace = {
  name: string;
  path: string;
};

export type Note = {
  title: string;
  path: string;
  workspace: Workspace;
};

export type View = {
  id: string;
  name: string;
  description: string;
  workspace: Workspace;
};

export type Attachment = {
  name: string;
  path: string;
  extension: string;
  workspace: Workspace;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function hasStringProperty(value: UnknownRecord, key: string): boolean {
  return typeof value[key] === "string";
}

export function isWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value)) {
    return false;
  }

  return hasStringProperty(value, "name") && hasStringProperty(value, "path");
}

export function isNote(value: unknown): value is Note {
  if (!isRecord(value)) {
    return false;
  }

  return hasStringProperty(value, "title") && hasStringProperty(value, "path") && isWorkspace(value.workspace);
}

export function isView(value: unknown): value is View {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasStringProperty(value, "id") &&
    hasStringProperty(value, "name") &&
    hasStringProperty(value, "description") &&
    isWorkspace(value.workspace)
  );
}

export function isAttachment(value: unknown): value is Attachment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasStringProperty(value, "name") &&
    hasStringProperty(value, "path") &&
    hasStringProperty(value, "extension") &&
    isWorkspace(value.workspace)
  );
}
