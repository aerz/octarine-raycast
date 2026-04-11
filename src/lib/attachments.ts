import path from "node:path";
import { type IndexedAttachment } from "../types/attachments";
import type { Workspace } from "../types/octarine";
import { AttachmentsCache } from "./cache";
import { isDirectoryPath, scanWorkspaceAttachmentFiles } from "./files";
import { buildSearchText } from "./search";

async function scanWorkspaceAttachments(
  workspace: Workspace,
  excludedExtensions: Set<string>,
  excludedDirectoryNames: Set<string>,
): Promise<IndexedAttachment[]> {
  const normalizedWorkspacePath = path.normalize(path.resolve(workspace.path));
  const normalizedWorkspace = { ...workspace, path: normalizedWorkspacePath };
  if (!(await isDirectoryPath(normalizedWorkspacePath))) {
    console.warn("Skipping workspace path because it is not an accessible directory", {
      workspacePath: normalizedWorkspacePath,
    });
    return [];
  }

  const files = await scanWorkspaceAttachmentFiles(normalizedWorkspacePath);

  return files
    .filter((file) => !isExcludedAttachmentPath(file.relative, excludedDirectoryNames))
    .flatMap((file) => {
      const extension = path.extname(file.name).slice(1).toLowerCase();
      if (excludedExtensions.has(extension)) {
        return [];
      }

      return {
        name: file.name,
        path: file.absolute,
        extension,
        workspace: normalizedWorkspace,
        searchText: buildSearchText(file.name, normalizedWorkspace.name, extension),
      };
    });
}

export async function getAttachments(
  workspaces: Workspace[],
  excludedExtensions: Set<string>,
  excludedDirectoryNames: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedAttachment[]> {
  const refresh = options?.refresh ?? false;
  const visibleWorkspaces = workspaces.filter(isVisibleWorkspace);

  if (!refresh) {
    const cached = AttachmentsCache.read(visibleWorkspaces, excludedDirectoryNames, excludedExtensions);
    if (cached) {
      return cached;
    }
  }

  const attachments = await scanAttachments(visibleWorkspaces, excludedExtensions, excludedDirectoryNames);
  AttachmentsCache.write(attachments, visibleWorkspaces, excludedDirectoryNames, excludedExtensions);
  return attachments;
}

async function scanAttachments(
  workspaces: Workspace[],
  excludedExtensions: Set<string>,
  excludedDirectoryNames: Set<string>,
): Promise<IndexedAttachment[]> {
  const byWorkspace = await Promise.all(
    workspaces.map((workspace) => scanWorkspaceAttachments(workspace, excludedExtensions, excludedDirectoryNames)),
  );

  return byWorkspace.flat().toSorted(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.path.localeCompare(b.path),
  );
}

function isVisibleWorkspace(workspace: Workspace): boolean {
  const { invalid = false, ignored = false } = workspace as Workspace & {
    invalid?: boolean;
    ignored?: boolean;
  };

  return !invalid && !ignored;
}

function isExcludedAttachmentPath(relative: string, excludedDirectoryNames: Set<string>): boolean {
  const segments = relative.split(path.posix.sep).slice(0, -1);
  return segments.some((segment) => excludedDirectoryNames.has(segment.toLowerCase()));
}
