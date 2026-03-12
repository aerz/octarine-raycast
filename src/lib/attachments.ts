import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { AttachmentFile } from "../types/attachment";
import { Workspace, loadWorkspaces } from "../lib/workspaces";

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

function parseExcludedExtensions(rawValue?: string): Set<string> {
  const excludedExtensions = new Set<string>();
  if (!rawValue) {
    return excludedExtensions;
  }

  for (const part of rawValue.split(",")) {
    const normalized = part.trim().toLowerCase().replace(/^\./, "");
    if (!normalized) {
      continue;
    }

    excludedExtensions.add(normalized);
  }

  return excludedExtensions;
}

function buildAttachmentSearchText(name: string, workspaceName: string, extension: string): string {
  return `${name} ${workspaceName} ${extension}`.toLowerCase();
}

async function collectAttachmentFiles(
  attachmentsPath: string,
  workspaceName: string,
  workspacePath: string,
  initialEntries: Dirent[],
  excludedExtensions: Set<string>,
): Promise<AttachmentFile[]> {
  const files: AttachmentFile[] = [];
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
          workspacePath,
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

      files.push({
        name: entry.name,
        path: absoluteEntryPath,
        extension,
        workspaceName,
        workspacePath,
        searchText: buildAttachmentSearchText(entry.name, workspaceName, extension),
      });
    }
  }

  return files;
}

async function scanAttachmentDirectory(
  workspace: Workspace,
  normalizedWorkspacePath: string,
  directoryName: (typeof ATTACHMENT_DIRECTORIES)[number],
  excludedExtensions: Set<string>,
): Promise<AttachmentFile[]> {
  const attachmentsPath = path.join(normalizedWorkspacePath, directoryName);
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
      workspacePath: normalizedWorkspacePath,
      attachmentsPath,
      directoryName,
      error,
    });
    return [];
  }

  if (rootEntries.length === 0) {
    return [];
  }

  return collectAttachmentFiles(
    attachmentsPath,
    workspace.name,
    normalizedWorkspacePath,
    rootEntries,
    excludedExtensions,
  );
}

async function scanWorkspaceAttachments(
  workspace: Workspace,
  excludedExtensions: Set<string>,
): Promise<AttachmentFile[]> {
  const normalizedWorkspacePath = path.normalize(path.resolve(workspace.path));
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
      scanAttachmentDirectory(workspace, normalizedWorkspacePath, directoryName, excludedExtensions),
    ),
  );

  return attachmentsByDirectory.flat();
}

export async function scanAttachmentsFromPreferences(excludeFileExtensions?: string): Promise<AttachmentFile[]> {
  const workspaceResult = await loadWorkspaces();
  const excludedExtensions = parseExcludedExtensions(excludeFileExtensions);

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

  return attachments;
}
