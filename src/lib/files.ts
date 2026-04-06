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

async function scanWorkspaceRootPaths(root: string, excludedWorkspaces: Set<string>): Promise<string[]> {
  const discovered: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const dir = pending.pop()!;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasWorkspaceMarker = entries.some((entry) => entry.isDirectory() && entry.name === WORKSPACE_DIR_NAME);
    if (hasWorkspaceMarker) {
      const workspacePath = path.normalize(path.resolve(dir));
      const workspaceName = path.basename(workspacePath).toLowerCase();

      if (!excludedWorkspaces.has(workspaceName)) {
        discovered.push(workspacePath);
      }

      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name === WORKSPACE_DIR_NAME) {
        continue;
      }

      pending.push(path.join(dir, entry.name));
    }
  }

  return discovered;
}

export async function scanWorkspacePaths(
  roots: string[],
  excludedWorkspaces: Set<string>,
): Promise<ScanWorkspacePathsResult> {
  const results = await Promise.all(
    roots.map(async (root) => {
      try {
        const stat = await fs.stat(root);
        if (!stat.isDirectory()) {
          return { root, invalid: true, paths: [] as string[] };
        }
      } catch {
        return { root, invalid: true, paths: [] as string[] };
      }

      return {
        root,
        invalid: false,
        paths: await scanWorkspaceRootPaths(root, excludedWorkspaces),
      };
    }),
  );

  const invalidRoots: string[] = [];
  const discovered = new Set<string>();

  for (const result of results) {
    if (result.invalid) {
      invalidRoots.push(result.root);
      continue;
    }

    for (const workspacePath of result.paths) {
      discovered.add(workspacePath);
    }
  }

  return {
    paths: [...discovered],
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
