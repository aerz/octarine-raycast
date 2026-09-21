import path from "node:path";
import { type Folder, type Workspace } from "../types/octarine";
import { type IndexedNote } from "../types/notes";
import { DailyNotesCache, NotesCache } from "./cache";
import {
  DAILY_DIRECTORY_NAME,
  dailyTimestamp,
  dailyNoteStem,
  formatDateLabel,
  formatWeekLabel,
  parseFilenameDate,
  type FilenameDate,
} from "./daily-desk";
import { isDirectoryPath, readMarkdownFrontmatter, scanMarkdownFiles } from "./files";
import { buildSearchText } from "./search";

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([".octarine", ".templates"]);
const ROOT_FOLDER_PATH = "";

type BuildIndexedNoteInput = {
  workspace: Workspace;
  relative: string;
  folder: Folder;
  pinned?: boolean;
};

type NotesCacheStore = {
  read(workspaces: Workspace[], excludedDirectories: Set<string>): IndexedNote[] | undefined;
  write(notes: IndexedNote[], workspaces: Workspace[], excludedDirectories: Set<string>): void;
};

export async function getNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  return getCachedNotes(NotesCache, scanNotes, workspaces, excludedDirectories, options);
}

export async function getDailyNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  return getCachedNotes(DailyNotesCache, scanDailyNotes, workspaces, excludedDirectories, options);
}

async function getCachedNotes(
  cache: NotesCacheStore,
  scan: (workspaces: Workspace[], excludedDirectories: Set<string>) => Promise<IndexedNote[]>,
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  options?: { refresh?: boolean },
): Promise<IndexedNote[]> {
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const cached = cache.read(workspaces, excludedDirectories);
    if (cached) {
      return cached;
    }
  }

  const notes = await scan(workspaces, excludedDirectories);
  cache.write(notes, workspaces, excludedDirectories);
  return notes;
}

export async function scanNotes(workspaces: Workspace[], excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const notes = await scanAcrossWorkspaces(workspaces, excludedDirectories, scanWorkspaceNotes);
  return notes.toSorted(
    (a, b) => a.folder.workspace.name.localeCompare(b.folder.workspace.name) || a.path.localeCompare(b.path),
  );
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

export async function scanDailyNotes(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
): Promise<IndexedNote[]> {
  const notes = await scanAcrossWorkspaces(workspaces, excludedDirectories, scanWorkspaceDailyNotes);
  const timestampById = new Map(notes.map((note) => [note.id, dailyTimestamp(note.path)]));

  return notes.toSorted((a, b) => compareDailyNotes(a, b, timestampById));
}

async function scanAcrossWorkspaces(
  workspaces: Workspace[],
  excludedDirectories: Set<string>,
  scanWorkspace: (workspace: Workspace, excludedDirectories: Set<string>) => Promise<IndexedNote[]>,
): Promise<IndexedNote[]> {
  const excluded = withDefaultExcluded(excludedDirectories);
  const byWorkspace = await Promise.all(workspaces.map((workspace) => scanWorkspace(workspace, excluded)));

  const byId = new Map(byWorkspace.flat().map((note) => [note.id, note]));
  return [...byId.values()];
}

async function scanWorkspaceDailyNotes(workspace: Workspace, excludedDirectories: Set<string>): Promise<IndexedNote[]> {
  const dailyRoot = path.join(workspace.path, DAILY_DIRECTORY_NAME);
  if (!(await isDirectoryPath(dailyRoot))) {
    return [];
  }

  const files = await scanMarkdownFiles(dailyRoot, excludedDirectories);
  const notes: IndexedNote[] = [];

  for (const file of files) {
    const parsed = parseFilenameDate(file.relative);
    if (parsed) {
      notes.push(buildDailyNote(workspace, file.relative, parsed));
    }
  }

  return notes;
}

function buildDailyNote(workspace: Workspace, relative: string, parsed: FilenameDate): IndexedNote {
  const folder = buildFolder(workspace, DAILY_DIRECTORY_NAME);
  const notePath = path.posix.join(DAILY_DIRECTORY_NAME, relative);
  const label = parsed.kind === "week" ? formatWeekLabel(parsed.week) : formatDateLabel(parsed.iso);
  const dateStem = dailyNoteStem(relative);

  return {
    id: `${workspace.name}::${notePath}`,
    title: label,
    folder,
    path: notePath,
    pinned: false,
    searchText: buildSearchText(label, dateStem, notePath, workspace.name),
  };
}

function compareDailyNotes(a: IndexedNote, b: IndexedNote, timestampById: Map<string, number | null>): number {
  const aTime = timestampById.get(a.id) ?? null;
  const bTime = timestampById.get(b.id) ?? null;

  if (aTime === null && bTime === null) {
    return a.path.localeCompare(b.path);
  }
  if (aTime === null) {
    return 1;
  }
  if (bTime === null) {
    return -1;
  }

  return bTime - aTime || a.path.localeCompare(b.path);
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

function withDefaultExcluded(directories: Set<string>): Set<string> {
  return new Set([...DEFAULT_EXCLUDED_DIRECTORY_NAMES, ...directories]);
}
