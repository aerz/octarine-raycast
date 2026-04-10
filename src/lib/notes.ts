import path from "node:path";
import { type Folder, type Workspace } from "../types/octarine";
import { type IndexedNote, type IndexedFolder } from "../types/notes";
import { PinnedNotesCache, NotesCache } from "./cache";
import { readMarkdownFrontmatter, scanFolders, scanMarkdownFiles } from "./files";
import { buildSearchText } from "./search";

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);
const DAILY_FOLDER_RELATIVE_PATH = "daily";
const ROOT_FOLDER_PATH = "";

type BuildIndexedNoteInput = {
  workspace: Workspace;
  relative: string;
  folder: Folder;
  pinned?: boolean;
};

export async function getNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = NotesCache.read(workspaces, excludedDirectories);
    if (cached) {
      return cached;
    }
  }

  const notes = await scanNotes(workspaces, excludedDirectories);
  NotesCache.write(notes, workspaces, excludedDirectories);
  return notes;
}

export async function getPinnedNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = PinnedNotesCache.read(workspaces, excludedDirectories);
    if (cached) {
      return cached;
    }
  }

  const notes = await getNotes(workspaces, excludedDirectories, { refresh });
  const pinned = notes.filter((note) => note.pinned);
  PinnedNotesCache.write(pinned, workspaces, excludedDirectories);
  return pinned;
}

export async function scanNotes(workspaces: Workspace[], excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const excluded = withDefaultExcluded(excludedDirectories);
  const byWorkspace = await Promise.all(workspaces.map((workspace) => scanWorkspaceNotes(workspace, excluded)));

  const byId = new Map(byWorkspace.flat().map((note) => [note.id, note]));
  return [...byId.values()].toSorted(
    (a, b) => a.folder.workspace.name.localeCompare(b.folder.workspace.name) || a.path.localeCompare(b.path),
  );
}

export async function scanWorkspaceFolders(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
): Promise<IndexedFolder[]> {
  const excluded = withDefaultExcluded(excludedDirectories);
  const byWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const directories = await scanFolders(workspace.path, excluded);

      return [
        buildRootIndexedFolder(workspace),
        ...directories
          .filter((dir) => dir.relative !== DAILY_FOLDER_RELATIVE_PATH)
          .map((directory) => buildIndexedFolder(buildFolder(workspace, directory.relative))),
      ];
    }),
  );

  return byWorkspace.flat().sort((a, b) => {
    const byWorkspace = a.workspace.name.localeCompare(b.workspace.name);
    return byWorkspace !== 0 ? byWorkspace : a.path.localeCompare(b.path);
  });
}

async function scanWorkspaceNotes(workspace: Workspace, excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const files = await scanMarkdownFiles(workspace.path, excludedDirectories);

  return Promise.all(
    files.map(async (file) => {
      const frontmatter = await readMarkdownFrontmatter(file.absolute);
      const dir = path.posix.dirname(file.relative);
      const parent = dir === "." ? ROOT_FOLDER_PATH : dir;
      return buildIndexedNote({
        workspace,
        relative: file.relative,
        folder: buildFolder(workspace, parent),
        pinned: isPinnedInFrontmatter(frontmatter),
      });
    }),
  );
}

function buildIndexedNote(input: BuildIndexedNoteInput): IndexedNote {
  const { workspace, relative, folder, pinned = false } = input;
  const title = path.posix.basename(relative, ".md");

  return {
    id: `${workspace.name}::${relative}`,
    title,
    folder,
    path: relative,
    pinned,
    searchText: buildSearchText(title, relative, folder.workspace.name),
  };
}

function isPinnedInFrontmatter(frontmatter: string | undefined): boolean {
  if (!frontmatter) return false;
  return /^pinned\s*:\s*true\s*$/m.test(frontmatter);
}

function buildFolder(workspace: Workspace, folderPath: string): Folder {
  return {
    name: folderPath === ROOT_FOLDER_PATH ? "" : path.posix.basename(folderPath),
    path: folderPath,
    workspace,
  };
}

function buildIndexedFolder(folder: Folder, options: { name?: string; searchName?: string } = {}): IndexedFolder {
  const { name = folder.name, searchName = name } = options;

  return {
    ...folder,
    id: `${folder.workspace.path}::${folder.path || "."}`,
    name,
    searchText: buildSearchText(searchName, folder.path, folder.workspace.name),
  };
}

function buildRootIndexedFolder(workspace: Workspace): IndexedFolder {
  return buildIndexedFolder(buildFolder(workspace, ROOT_FOLDER_PATH), {
    name: "Root (No folder)",
    searchName: "root",
  });
}

function withDefaultExcluded(directories: Set<string>): Set<string> {
  return new Set([...DEFAULT_EXCLUDED_DIRECTORY_NAMES, ...directories]);
}
