import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

const OCTARINE_WORKSPACE_DIRECTORY = ".octarine";
const OCTARINE_VIEWS_FILE = "views.json";

export type MarkdownFile = {
  absolute: string;
  relative: string;
};

export type ScannedPath = {
  path: string;
  ignored: boolean;
  invalid: boolean;
};

export type FolderEntry = {
  name: string;
  absolute: string;
  relative: string;
};

function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeStart(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

function extractFrontmatter(content: string): string | undefined {
  const normalized = normalizeStart(content);
  const lines = normalized.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return undefined;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (/^\s*(---|\.\.\.)\s*$/.test(lines[index])) {
      return lines.slice(0, index + 1).join("\n");
    }
  }

  return undefined;
}

export async function scanPaths(roots: string[], excluded: Set<string>): Promise<ScannedPath[]> {
  const discovered = new Map<string, ScannedPath>();

  const addWorkspace = (workspacePath: string) => {
    discovered.set(workspacePath, {
      path: workspacePath,
      ignored: excluded.has(path.basename(workspacePath).toLowerCase()),
      invalid: false,
    });
  };

  const addInvalidPath = (workspacePath: string) => {
    discovered.set(workspacePath, {
      path: workspacePath,
      ignored: false,
      invalid: true,
    });
  };

  await Promise.all(
    roots.map(async (root) => {
      const resolvedRoot = path.resolve(root);

      let entries;
      try {
        entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
      } catch {
        addInvalidPath(resolvedRoot);
        return;
      }

      if (entries.some((e) => e.isDirectory() && e.name === OCTARINE_WORKSPACE_DIRECTORY)) {
        addWorkspace(resolvedRoot);
        return;
      }

      const directories = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith("."));

      await Promise.all(
        directories.map(async (dir) => {
          const childPath = path.join(resolvedRoot, dir.name);
          try {
            const stat = await fs.stat(path.join(childPath, OCTARINE_WORKSPACE_DIRECTORY));
            if (stat.isDirectory()) addWorkspace(childPath);
          } catch {
            return;
          }
        }),
      );
    }),
  );

  return Array.from(discovered.values());
}

export async function scanMarkdownFiles(root: string, excluded: Set<string>): Promise<MarkdownFile[]> {
  const pending: string[] = [root];
  const files: MarkdownFile[] = [];

  while (pending.length > 0) {
    const dir = pending.pop()!;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory ${dir}: ${toErrorMessage(error)}`);
    }

    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const name = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (!entry.isSymbolicLink() && !excluded.has(name)) {
          pending.push(absolute);
        }
        continue;
      }

      if (!entry.isFile() || path.extname(name) !== ".md") {
        continue;
      }

      files.push({
        absolute,
        relative: toPosixPath(path.relative(root, absolute)),
      });
    }
  }

  return files;
}

export async function scanFolders(root: string, excluded: Set<string>): Promise<FolderEntry[]> {
  const pending: Array<{ absolute: string; relative: string }> = [{ absolute: root, relative: "" }];
  const directories: FolderEntry[] = [];

  while (pending.length > 0) {
    const { absolute: currentAbsolute, relative: currentRelative } = pending.pop()!;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentAbsolute, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory ${currentAbsolute}: ${toErrorMessage(error)}`);
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || excluded.has(entry.name.toLowerCase())) {
        continue;
      }

      const absolute = path.join(currentAbsolute, entry.name);
      const relative = currentRelative ? path.posix.join(currentRelative, entry.name) : entry.name;

      directories.push({
        name: entry.name,
        absolute,
        relative,
      });

      pending.push({ absolute, relative });
    }
  }

  return directories;
}

export async function readMarkdownFrontmatter(filePath: string): Promise<string | undefined> {
  try {
    const fd = await fs.open(filePath, "r");

    try {
      const decoder = new StringDecoder("utf8");
      const buffer = Buffer.alloc(512);
      let content = "";
      let position = 0;

      while (true) {
        const { bytesRead } = await fd.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0) {
          content += decoder.end();
          return extractFrontmatter(content);
        }

        position += bytesRead;
        content += decoder.write(buffer.subarray(0, bytesRead));

        const normalized = normalizeStart(content);
        if (normalized.length >= 3 && !normalized.startsWith("---")) {
          return undefined;
        }

        const frontmatter = extractFrontmatter(content);
        if (frontmatter) {
          return frontmatter;
        }
      }
    } finally {
      await fd.close();
    }
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${toErrorMessage(error)}`);
  }
}

export async function readViewsFile(workspacePath: string): Promise<unknown | undefined> {
  const filePath = path.join(workspacePath, OCTARINE_WORKSPACE_DIRECTORY, OCTARINE_VIEWS_FILE);
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      return undefined;
    }

    throw new Error(`Failed to read file ${filePath}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Failed to parse file ${filePath}`);
  }
}
