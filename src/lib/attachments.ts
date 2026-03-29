import { Dirent, Stats, promises as fs } from "node:fs";
import path from "node:path";
import { type IndexedAttachment, isIndexedAttachment } from "../types/attachment";
import type { Workspace } from "../types/octarine";
import { loadStoredJson, saveStoredJson } from "./localstorage";
import { buildSearchIndexText } from "./search";
import { loadWorkspaces } from "./workspaces";

const ATTACHMENT_DIRECTORIES = [".attachments", ".files"] as const;
const ATTACHMENTS_CACHE_KEY = "octarine.attachments.v1";
const ATTACHMENTS_CACHE_VERSION = 1;
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

type AttachmentsCache = {
  version: number;
  workspaceSearchSignature: string;
  excludedExtensionsSignature: string;
  workspaceCount: number;
  attachments: IndexedAttachment[];
};

export type AttachmentsSnapshot = {
  attachments: IndexedAttachment[];
  workspaceCount: number;
};

function isSystemGeneratedFile(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return normalizedName.startsWith("~$") || SYSTEM_GENERATED_FILE_NAMES.has(normalizedName);
}

function isAttachmentsCache(value: unknown): value is AttachmentsCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeCache = value as Partial<AttachmentsCache>;
  return (
    maybeCache.version === ATTACHMENTS_CACHE_VERSION &&
    typeof maybeCache.workspaceSearchSignature === "string" &&
    typeof maybeCache.excludedExtensionsSignature === "string" &&
    typeof maybeCache.workspaceCount === "number" &&
    Number.isInteger(maybeCache.workspaceCount) &&
    maybeCache.workspaceCount >= 0 &&
    Array.isArray(maybeCache.attachments) &&
    maybeCache.attachments.every(isIndexedAttachment)
  );
}

async function collectIndexedAttachments(
  attachmentsPath: string,
  workspace: Workspace,
  initialEntries: Dirent[],
  excludedExtensions: Set<string>,
  excludedDirectoryNames: Set<string>,
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
      const normalizedEntryName = entry.name.toLowerCase();

      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (excludedDirectoryNames.has(normalizedEntryName)) {
          continue;
        }

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
  excludedDirectoryNames: Set<string>,
): Promise<IndexedAttachment[]> {
  const attachmentsPath = path.join(workspace.path, directoryName);
  let attachmentsStats: Stats;
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

  return collectIndexedAttachments(attachmentsPath, workspace, rootEntries, excludedExtensions, excludedDirectoryNames);
}

async function scanWorkspaceAttachments(
  workspace: Workspace,
  excludedExtensions: Set<string>,
  excludedDirectoryNames: Set<string>,
): Promise<IndexedAttachment[]> {
  const normalizedWorkspacePath = path.normalize(path.resolve(workspace.path));
  const normalizedWorkspace = { ...workspace, path: normalizedWorkspacePath };
  let workspaceStats: Stats;
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
      scanAttachmentDirectory(normalizedWorkspace, directoryName, excludedExtensions, excludedDirectoryNames),
    ),
  );

  return attachmentsByDirectory.flat();
}

export async function loadCachedAttachments(
  workspaceSearchSignature: string,
  excludedExtensionsSignature: string,
): Promise<AttachmentsSnapshot | undefined> {
  const cached = await loadStoredJson(ATTACHMENTS_CACHE_KEY, isAttachmentsCache);

  if (
    !cached ||
    cached.workspaceSearchSignature !== workspaceSearchSignature ||
    cached.excludedExtensionsSignature !== excludedExtensionsSignature
  ) {
    return undefined;
  }

  return {
    workspaceCount: cached.workspaceCount,
    attachments: cached.attachments,
  };
}

export async function saveCachedAttachments(
  snapshot: AttachmentsSnapshot,
  workspaceSearchSignature: string,
  excludedExtensionsSignature: string,
): Promise<void> {
  await saveStoredJson(ATTACHMENTS_CACHE_KEY, {
    version: ATTACHMENTS_CACHE_VERSION,
    workspaceSearchSignature,
    excludedExtensionsSignature,
    workspaceCount: snapshot.workspaceCount,
    attachments: snapshot.attachments,
  });
}

export async function scanAttachments(options?: {
  forceRefresh?: boolean;
  excludedExtensions?: Set<string>;
  excludedDirectoryNames?: Set<string>;
}): Promise<AttachmentsSnapshot> {
  const workspaceResult = await loadWorkspaces({ refresh: options?.forceRefresh });
  const excludedExtensions = options?.excludedExtensions ?? new Set<string>();
  const excludedDirectoryNames = options?.excludedDirectoryNames ?? new Set<string>();

  for (const invalidRoot of workspaceResult.invalidRoots) {
    console.warn("Skipping inaccessible workspace root", { root: invalidRoot });
  }

  const attachmentsByWorkspace = await Promise.all(
    workspaceResult.workspaces.map((workspace) =>
      scanWorkspaceAttachments(workspace, excludedExtensions, excludedDirectoryNames),
    ),
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
