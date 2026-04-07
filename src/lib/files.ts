import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

const WORKSPACE_DIR_NAME = ".octarine";

export type MarkdownFile = {
  absolute: string;
  relative: string;
};

export type ScanWorkspacePathsResult = {
  paths: string[];
  invalidRoots: string[];
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

export async function scanWorkspacePaths(
  roots: string[],
  excludedWorkspaces: Set<string>,
): Promise<ScanWorkspacePathsResult> {
  const invalidRoots: string[] = [];
  const discovered = new Set<string>();

  const addWorkspace = (workspacePath: string) => {
    const name = path.basename(workspacePath).toLowerCase();
    if (!excludedWorkspaces.has(name)) discovered.add(workspacePath);
  };

  await Promise.all(
    roots.map(async (root) => {
      const resolvedRoot = path.resolve(root);

      let entries;
      try {
        entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
      } catch {
        invalidRoots.push(root);
        return;
      }

      if (entries.some((e) => e.isDirectory() && e.name === WORKSPACE_DIR_NAME)) {
        addWorkspace(resolvedRoot);
        return;
      }

      const directories = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith("."));

      await Promise.all(
        directories.map(async (dir) => {
          const childPath = path.join(resolvedRoot, dir.name);
          try {
            const stat = await fs.stat(path.join(childPath, WORKSPACE_DIR_NAME));
            if (stat.isDirectory()) addWorkspace(childPath);
          } catch {
            return;
          }
        }),
      );
    }),
  );

  return {
    paths: Array.from(discovered),
    invalidRoots,
  };
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
