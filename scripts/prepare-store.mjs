import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const files = new Set([
  ".gitignore",
  ".prettierrc",
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "eslint.config.js",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
]);
const directories = new Set(["assets", "media", "metadata", "src", "tests"]);
const excluded = new Set(["AGENTS.md", "flake.nix", "flake.lock", ".envrc"]);
const usage = "Usage: npm run prepare:store -- <store-checkout> [--dry-run]";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function checkRepository(root, label) {
  if (realpathSync(git(root, "rev-parse", "--show-toplevel")) !== root) {
    throw new Error(`${label} must be the repository root.`);
  }
  if (git(root, "status", "--porcelain=v1", "--untracked-files=all")) {
    throw new Error(`${label} has uncommitted changes. Commit or stash them before preparing.`);
  }
}

function readTree(root) {
  return new Map(
    git(root, "ls-tree", "-r", "-z", "HEAD")
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("\t");
        const [mode, type, hash] = entry.slice(0, separator).split(" ");
        return [entry.slice(separator + 1), { mode, type, hash }];
      }),
  );
}

function isPublished(name) {
  return !excluded.has(path.posix.basename(name)) && (files.has(name) || directories.has(name.split("/")[0]));
}

function checkPath(root, name) {
  const parts = name.split("/");
  let current = root;
  for (const [index, part] of parts.entries()) {
    if (!part || part === "." || part === "..") throw new Error(`Invalid path: ${name}`);
    current = path.join(current, part);
    // existsSync misses broken symlinks; inspect the entry itself instead.
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Destination contains a symlink: ${name}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`Destination parent is not a directory: ${name}`);
    }
  }
  return current;
}

function readContent(root, name, entry) {
  if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
    throw new Error(`Only regular files can be exported: ${name}`);
  }
  const content = execFileSync("git", ["cat-file", "blob", entry.hash], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (name !== "package.json") return content;

  const manifest = JSON.parse(content.toString("utf8"));
  if (manifest.name !== "octarine") throw new Error("Source must be the Octarine extension.");
  delete manifest.scripts["prepare:store"];
  delete manifest.scripts["sync:store"];
  manifest.scripts.publish = "ray publish";
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
}

function prepare() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(`${usage}\nPrepares committed main in a clean raycast-store worktree, then runs npm checks.`);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const targets = args.filter((arg) => arg !== "--dry-run");
  if (args.length > 2 || targets.length !== 1 || targets[0].startsWith("-")) throw new Error(usage);

  const source = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const target = realpathSync(path.resolve(targets[0]));
  checkRepository(source, "Source");
  checkRepository(target, "Store");
  if (git(source, "branch", "--show-current") !== "main") throw new Error("Source must be on branch main.");
  if (git(target, "branch", "--show-current") !== "raycast-store") {
    throw new Error("Store must be on branch raycast-store.");
  }
  const sourceGit = realpathSync(path.resolve(source, git(source, "rev-parse", "--git-common-dir")));
  const targetGit = realpathSync(path.resolve(target, git(target, "rev-parse", "--git-common-dir")));
  if (sourceGit !== targetGit) throw new Error("Store must be a worktree of the source repository.");

  const sourceFiles = readTree(source);
  if (!sourceFiles.has("package.json")) throw new Error("Source HEAD has no package.json.");
  const published = new Map([...sourceFiles].filter(([name]) => isPublished(name)));
  const targetFiles = readTree(target);
  const changes = [];

  for (const name of targetFiles.keys()) {
    if (!published.has(name)) {
      const filename = checkPath(target, name);
      if (!lstatSync(filename).isFile()) throw new Error(`Destination is not a regular file: ${name}`);
      changes.push({ name, filename, action: "DELETE" });
    }
  }
  for (const [name, entry] of published) {
    const content = readContent(source, name, entry);
    const filename = checkPath(target, name);
    const previous = targetFiles.get(name);
    if (existsSync(filename)) {
      if (!previous) throw new Error(`Destination contains an untracked file: ${name}`);
      if (!lstatSync(filename).isFile()) throw new Error(`Destination is not a regular file: ${name}`);
      const executable = (lstatSync(filename).mode & 0o111) !== 0;
      if (content.equals(readFileSync(filename)) && executable === (entry.mode === "100755")) continue;
    }
    changes.push({ name, filename, content, mode: entry.mode, action: previous ? "MODIFY" : "ADD" });
  }

  console.log(`Source main: ${git(source, "rev-parse", "HEAD")}`);
  console.log(`Store: ${target}`);
  for (const change of changes) {
    console.log(`${change.action} ${change.name}`);
    if (dryRun) continue;
    if (change.action === "DELETE") {
      unlinkSync(change.filename);
    } else {
      mkdirSync(path.dirname(change.filename), { recursive: true });
      const temporary = path.join(path.dirname(change.filename), `.prepare-store-${randomUUID()}`);
      try {
        writeFileSync(temporary, change.content, { flag: "wx" });
        chmodSync(temporary, change.mode === "100755" ? 0o755 : 0o644);
        renameSync(temporary, change.filename);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
    }
  }
  if (dryRun) {
    console.log(`Dry run: ${changes.length} changes. No files written or npm checks run.`);
    return;
  }
  for (const command of [["ci"], ["test"], ["run", "build"], ["run", "lint"]]) {
    execFileSync("npm", command, { cwd: target, stdio: "inherit" });
  }
  console.log(`Prepared ${changes.length} changes. Review and commit the Store delivery before syncing.`);
}

try {
  prepare();
} catch (error) {
  console.error(`Preparation failed: ${error.message}`);
  process.exitCode = 1;
}
