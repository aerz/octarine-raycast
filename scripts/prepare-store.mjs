import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const usage = "Usage: npm run prepare:store -- [--dry-run]";

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

function readTree(root, ref) {
  return new Map(
    git(root, "ls-tree", "-r", "-z", ref)
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

function prepare() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(`${usage}\nValidates committed main in a temporary worktree and commits the Store delivery.`);
    return;
  }
  const dryRun = args.includes("--dry-run");
  if (args.length > 1 || args.some((arg) => arg !== "--dry-run")) throw new Error(usage);

  const source = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  checkRepository(source, "Source");
  if (git(source, "branch", "--show-current") !== "main") throw new Error("Source must be on branch main.");
  const sourceSha = git(source, "rev-parse", "HEAD");
  const storeSha = git(source, "rev-parse", "--verify", "refs/heads/raycast-store");
  const sourceFiles = readTree(source, sourceSha);
  if (!sourceFiles.has("package.json")) throw new Error("Source HEAD has no package.json.");
  const published = new Map();
  for (const [name, entry] of sourceFiles) {
    if (!isPublished(name)) continue;
    let content = readContent(source, name, entry);
    if (name === "package.json") {
      const manifest = JSON.parse(content.toString("utf8"));
      if (manifest.name !== "octarine") throw new Error("Source must be the Octarine extension.");
      delete manifest.scripts["prepare:store"];
      delete manifest.scripts["sync:store"];
      manifest.scripts.publish = "ray publish";
      content = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    }
    published.set(name, { ...entry, content });
  }
  const targetFiles = readTree(source, storeSha);
  const changes = [];

  for (const name of targetFiles.keys()) {
    if (!published.has(name)) {
      changes.push({ name, action: "DELETE" });
    }
  }
  for (const [name, entry] of published) {
    const previous = targetFiles.get(name);
    if (
      previous?.mode === entry.mode &&
      (name === "package.json"
        ? entry.content.equals(readContent(source, name, previous))
        : previous.hash === entry.hash)
    )
      continue;
    changes.push({ name, action: previous ? "MODIFY" : "ADD" });
  }

  console.log(`Source main: ${sourceSha}`);
  console.log("Store branch: raycast-store");
  for (const change of changes) {
    console.log(`${change.action} ${change.name}`);
  }
  if (dryRun) {
    console.log(`Dry run: ${changes.length} changes. No files written or npm checks run.`);
    return;
  }
  const temporary = mkdtempSync(path.join(tmpdir(), "octarine-store-"));
  const target = path.join(temporary, "store");
  try {
    git(source, "worktree", "add", "--quiet", target, "raycast-store");
    if (git(target, "rev-parse", "HEAD") !== storeSha) {
      throw new Error("Store branch changed during preparation. Run prepare:store again.");
    }
    git(target, "rm", "-r", "--", ".");
    for (const [name, entry] of published) {
      const filename = path.join(target, name);
      mkdirSync(path.dirname(filename), { recursive: true });
      writeFileSync(filename, entry.content);
      chmodSync(filename, entry.mode === "100755" ? 0o755 : 0o644);
    }
    git(target, "add", "--", ...published.keys());
    for (const command of [["ci", "--include=dev"], ["test"], ["run", "build"], ["run", "lint"]]) {
      execFileSync("npm", command, { cwd: target, stdio: "inherit" });
    }
    git(target, "diff", "--exit-code");
    git(target, "diff", "--cached", "--check");
    if (git(target, "diff", "--cached", "--name-only")) {
      git(target, "commit", "-m", "prepare extension for raycast store", "-m", `Source main: ${sourceSha}`);
      console.log(`Store commit: ${git(target, "rev-parse", "HEAD")}`);
    } else {
      console.log("Store delivery is unchanged. No new commit created.");
    }
  } finally {
    if (existsSync(path.join(target, ".git"))) git(source, "worktree", "remove", "--force", target);
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log("Review with git show raycast-store. Push the Store branch separately when ready.");
}

try {
  prepare();
} catch (error) {
  console.error(`Preparation failed: ${error.message}`);
  process.exitCode = 1;
}
