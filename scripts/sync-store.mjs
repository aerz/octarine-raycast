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

const excluded = new Set(["AGENTS.md", "flake.nix", "flake.lock", ".envrc"]);
const extension = "extensions/octarine";
const usage = "Usage: npm run sync:store -- <fork-checkout> [--dry-run]";

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
    throw new Error(`${label} has uncommitted changes. Commit or stash them before syncing.`);
  }
}

function readTree(root, ref, prefix = "") {
  const tree = git(root, "ls-tree", "-r", "-z", ref, "--", ...(prefix ? [prefix] : []));
  return new Map(
    tree
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("\t");
        const [mode, type, hash] = entry.slice(0, separator).split(" ");
        const name = entry.slice(separator + 1);
        return [prefix ? name.slice(prefix.length + 1) : name, { mode, type, hash }];
      }),
  );
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
  return execFileSync("git", ["cat-file", "blob", entry.hash], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sync() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(`${usage}\nCopies committed raycast-store from main to a clean local fork.`);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const targets = args.filter((arg) => arg !== "--dry-run");
  if (args.length > 2 || targets.length !== 1 || targets[0].startsWith("-")) throw new Error(usage);

  const project = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const target = realpathSync(path.resolve(targets[0]));
  checkRepository(target, "Destination");
  if (git(project, "branch", "--show-current") !== "main") throw new Error("Source must be on branch main.");
  const storeSha = git(project, "rev-parse", "--verify", "refs/heads/raycast-store");
  const projectGit = realpathSync(path.resolve(project, git(project, "rev-parse", "--git-common-dir")));
  const targetGit = realpathSync(path.resolve(target, git(target, "rev-parse", "--git-common-dir")));
  if (projectGit === targetGit) throw new Error("Source and destination must be different repositories.");

  const remote = git(target, "remote", "get-url", "origin");
  const url = new URL(remote.replace(/^git@github\.com:/, "https://github.com/"));
  if (url.hostname !== "github.com" || url.pathname.replace(/\.git$/, "") !== "/aerz/raycast-extensions") {
    throw new Error("Destination origin must be aerz/raycast-extensions on GitHub.");
  }
  if (git(target, "branch", "--show-current") !== "ext/octarine") {
    throw new Error("Destination must be on branch ext/octarine.");
  }

  const sourceFiles = readTree(project, storeSha);
  if (!sourceFiles.has("package.json") || !sourceFiles.has("package-lock.json")) {
    throw new Error("Store HEAD must include package.json and package-lock.json.");
  }
  for (const name of sourceFiles.keys()) {
    if (excluded.has(path.posix.basename(name)) || name === "CONTRIBUTING.md" || name.startsWith("scripts/")) {
      throw new Error(`Store contains local tooling: ${name}. Run prepare:store first.`);
    }
  }
  const manifest = JSON.parse(readContent(project, "package.json", sourceFiles.get("package.json")).toString("utf8"));
  if (
    manifest.name !== "octarine" ||
    manifest.scripts?.publish !== "ray publish" ||
    "prepare:store" in manifest.scripts ||
    "sync:store" in manifest.scripts
  ) {
    throw new Error("Store manifest is not prepared for publication. Run prepare:store first.");
  }
  const targetFiles = readTree(target, "HEAD", extension);
  const changes = [];

  for (const name of targetFiles.keys()) {
    if (!sourceFiles.has(name)) {
      const filename = checkPath(target, `${extension}/${name}`);
      if (!lstatSync(filename).isFile()) throw new Error(`Destination is not a regular file: ${name}`);
      changes.push({ name, filename, action: "DELETE" });
    }
  }
  for (const [name, entry] of sourceFiles) {
    const content = readContent(project, name, entry);
    const filename = checkPath(target, `${extension}/${name}`);
    const previous = targetFiles.get(name);
    if (existsSync(filename)) {
      if (!previous) throw new Error(`Destination contains an untracked file: ${name}`);
      if (!lstatSync(filename).isFile()) throw new Error(`Destination is not a regular file: ${name}`);
      const executable = (lstatSync(filename).mode & 0o111) !== 0;
      if (content.equals(readFileSync(filename)) && executable === (entry.mode === "100755")) continue;
    }
    changes.push({ name, filename, content, mode: entry.mode, action: previous ? "MODIFY" : "ADD" });
  }

  console.log(`Store HEAD: ${storeSha}`);
  console.log(`Destination: ${path.join(target, extension)}`);
  for (const change of changes) {
    console.log(`${change.action} ${extension}/${change.name}`);
    if (dryRun) continue;
    if (change.action === "DELETE") {
      unlinkSync(change.filename);
    } else {
      mkdirSync(path.dirname(change.filename), { recursive: true });
      const temporary = path.join(path.dirname(change.filename), `.sync-store-${randomUUID()}`);
      try {
        writeFileSync(temporary, change.content, { flag: "wx" });
        chmodSync(temporary, change.mode === "100755" ? 0o755 : 0o644);
        renameSync(temporary, change.filename);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
    }
  }
  console.log(dryRun ? `Dry run: ${changes.length} changes. No files written.` : `Synced ${changes.length} changes.`);
}

try {
  sync();
} catch (error) {
  console.error(`Sync failed: ${error.message}`);
  process.exitCode = 1;
}
