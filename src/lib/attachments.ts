import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import type { Workspace } from "../types/octarine";
import { buildSearchIndexText } from "./search";
import { IndexedAttachment } from "../types/attachment";
import { loadWorkspaces } from "../lib/workspaces";

const ATTACHMENT_DIRECTORIES = [".attachments", ".files"] as const;
const SYSTEM_GENERATED_FILE_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".spotlight-v100",
  ".trashes",
  ".fseventsd",
  ".temporaryitems",
  "ehthumbs.db",
  "ehthumbs_vista.db",
]);

function isSystemGeneratedFile(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return normalizedName.startsWith("~$") || SYSTEM_GENERATED_FILE_NAMES.has(normalizedName);
}

async function collectIndexedAttachments(
  attachmentsPath: string,
  workspace: Workspace,
  initialEntries: Dirent[],
  excludedExtensions: Set<string>,
): Promise<IndexedAttachment[]> {
  const attachments: IndexedAttachment[] = [];
  const pendingDirectories: Array<{ directory: string; entries?: Dirent[] }> = [
    { directory: attachmentsPath, entries: initialEntries },
  ];

  while (pendingDirectories.length > 0) {
    const next = pendingDirectories.pop();
    if (!next) {
      continue;
    }

    let entries = next.entries;
    if (!entries) {
      try {
        entries = await fs.readdir(next.directory, {
          withFileTypes: true,
        });
      } catch (error) {
        console.warn("Skipping unreadable attachments directory", {
          directory: next.directory,
          workspacePath: workspace.path,
          error,
        });
        continue;
      }
    }

    for (const entry of entries) {
      const absoluteEntryPath = path.resolve(next.directory, entry.name);

      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pendingDirectories.push({ directory: absoluteEntryPath });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (isSystemGeneratedFile(entry.name)) {
        continue;
      }

      const extension = path.extname(entry.name).slice(1).toLowerCase();
      if (excludedExtensions.has(extension)) {
        continue;
      }

      attachments.push({
        name: entry.name,
        path: absoluteEntryPath,
        extension,
        workspace,
        searchText: buildSearchIndexText(entry.name, workspace.name, extension),
      });
    }
  }

  return attachments;
}

async function scanAttachmentDirectory(
  workspace: Workspace,
  directoryName: (typeof ATTACHMENT_DIRECTORIES)[number],
  excludedExtensions: Set<string>,
): Promise<IndexedAttachment[]> {
  const attachmentsPath = path.join(workspace.path, directoryName);
  let attachmentsStats;
  try {
    attachmentsStats = await fs.stat(attachmentsPath);
  } catch {
    return [];
  }

  if (!attachmentsStats.isDirectory()) {
    return [];
  }

  let rootEntries: Dirent[];
  try {
    rootEntries = await fs.readdir(attachmentsPath, { withFileTypes: true });
  } catch (error) {
    console.warn("Skipping unreadable attachment directory", {
      workspacePath: workspace.path,
      attachmentsPath,
      directoryName,
      error,
    });
    return [];
  }

  if (rootEntries.length === 0) {
    return [];
  }

  return collectIndexedAttachments(attachmentsPath, workspace, rootEntries, excludedExtensions);
}

async function scanWorkspaceAttachments(
  workspace: Workspace,
  excludedExtensions: Set<string>,
): Promise<IndexedAttachment[]> {
  const normalizedWorkspacePath = path.normalize(path.resolve(workspace.path));
  const normalizedWorkspace = { ...workspace, path: normalizedWorkspacePath };
  let workspaceStats;
  try {
    workspaceStats = await fs.stat(normalizedWorkspacePath);
  } catch (error) {
    console.warn("Skipping inaccessible workspace path", {
      workspacePath: normalizedWorkspacePath,
      error,
    });
    return [];
  }

  if (!workspaceStats.isDirectory()) {
    console.warn("Skipping workspace path because it is not a directory", {
      workspacePath: normalizedWorkspacePath,
    });
    return [];
  }

  const attachmentsByDirectory = await Promise.all(
    ATTACHMENT_DIRECTORIES.map((directoryName) =>
      scanAttachmentDirectory(normalizedWorkspace, directoryName, excludedExtensions),
    ),
  );

  return attachmentsByDirectory.flat();
}

export type AttachmentScanResult = {
  attachments: IndexedAttachment[];
  workspaceCount: number;
};

export async function scanAttachments(options?: { excludedExtensions?: Set<string> }): Promise<AttachmentScanResult> {
  const workspaceResult = await loadWorkspaces();
  const excludedExtensions = options?.excludedExtensions ?? new Set<string>();

  for (const invalidRoot of workspaceResult.invalidRoots) {
    console.warn("Skipping inaccessible workspace root", { root: invalidRoot });
  }

  const attachmentsByWorkspace = await Promise.all(
    workspaceResult.workspaces.map((workspace) => scanWorkspaceAttachments(workspace, excludedExtensions)),
  );
  const attachments = attachmentsByWorkspace.flat();

  attachments.sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (byName !== 0) {
      return byName;
    }

    return left.path.localeCompare(right.path);
  });

  return {
    attachments,
    workspaceCount: workspaceResult.workspaces.length,
  };
}
