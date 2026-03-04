export type AttachmentFile = {
  // Filename with extension, for example "diagram.png".
  name: string;
  // Absolute resolved path.
  path: string;
  // Lowercase extension without dot, for example "png".
  extension: string;
  // Basename of the workspace root directory.
  workspaceName: string;
  // Absolute resolved path to workspace root.
  workspacePath: string;
};
