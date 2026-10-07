# Contributing

Develop in `main` of `aerz/octarine-raycast`. Its `raycast-store` branch contains
the committed delivery for the Store. Synchronize that delivery to
`extensions/octarine` on branch `ext/octarine` of `aerz/raycast-extensions`.

## Prepare the delivery

Commit the reviewed changes in `main` first. Run the preparation from `main`:

```sh
npm run prepare:store -- --dry-run
npm run prepare:store
git show raycast-store
```

The source checkout must be clean, including untracked files; ignored
dependencies and build output are allowed. The local `raycast-store` branch
must exist and must not be checked out elsewhere.

The script reads committed `main` and prepares `raycast-store` with `src`,
extension tests, assets, screenshots, README media, and the manifest, lockfile,
configuration, README, changelog, and license. `AGENTS.md`, `flake.nix`,
`flake.lock`, `.envrc`, both scripts, and this guide stay in `main`.
Dependencies are unchanged; the prepared manifest omits `prepare:store` and
`sync:store` and retains `publish: ray publish`.

The script creates a temporary worktree, prepares the files, and runs `npm ci --include=dev`,
`npm test`, `npm run build`, and `npm run lint`. If all checks pass, it commits
the delivery on `raycast-store` with the source commit's full message
and adds `Source main: <SHA>` to the body. An unchanged delivery creates no
new commit. A dry run only previews changes; it creates no worktree or commit.

The temporary worktree is removed after success or failure, and your checkout
stays on `main`. If a check fails, the Store branch remains unchanged. Fix and
commit the source in `main`, then prepare again.

Review the delivery before syncing. Push it separately when ready:

```sh
git push origin raycast-store
```

## Sync to the Store fork

Run the synchronization script from `main`, passing only the fork root:

```sh
npm run sync:store -- /path/to/raycast-extensions --dry-run
npm run sync:store -- /path/to/raycast-extensions
```

The fork must be clean and on `ext/octarine`. The script reads the local
`raycast-store` commit directly and copies it unchanged; it needs no Store
checkout and rejects local tooling or an unprepared manifest.

Only `extensions/octarine` is synchronized. Obsolete tracked files there are
removed; ignored build output is preserved. Both scripts reject source symlinks;
sync also rejects destination paths containing symlinks. Sync does not stage or
commit. Neither script pushes.

Review the fork's diff and check the distribution build in Raycast before
submitting. Commit and push to the PR branch are separate manual steps after
review. Commit or discard destination changes before another sync.

Keep edits from Raycast maintainers enabled on the PR. Incorporate contributions
and maintenance edits from the Store fork into `main` before preparing another
delivery, so they are not overwritten.

This follows Raycast's documented
[manual fork-and-PR workflow](https://developers.raycast.com/basics/publish-an-extension#alternative-way).
The source repository's `npm run publish` points here because running
`ray publish` from `main` would copy development files into the fork.

## GitHub releases

Download versioned copies of the extension from [GitHub Releases](https://github.com/aerz/octarine-raycast/releases) to install outside the Raycast Store.

The compiled ZIP (`octarine-vX.Y.Z.zip`) contains the built extension.
Extract the ZIP. Follow your application's extension import steps to load the folder that contains `package.json`.

Each release also includes source archives, which contain the source code.
Use these archives with applications that build extensions from source.

To install from source in Raycast, extract a source archive.
Import the extracted folder with Raycast's `Import Extension` command.
With Node.js and npm installed, run these commands in that folder:

```sh
npm ci --include=dev
npm run build
```

To prepare a release, start from a clean `main` checkout at the commit that you reviewed.
A tag gives a commit a name. Use SemVer tags such as `v1.0.0`.
For later releases, replace the version in these examples.

Install the dependencies from `package-lock.json`. Run the tests. Run lint.
Then build the ZIP:

```sh
npm ci --include=dev
npm test
npm run lint
npx ray bundle --output dist/octarine-v1.0.0.zip
zip -j dist/octarine-v1.0.0.zip LICENSE
```

The ZIP must contain `package.json`, all four compiled command files, `assets/`,
and `LICENSE`. If the ZIP contains Finder metadata (`.DS_Store`) from `assets/`, remove those files:

```sh
zip -d dist/octarine-v1.0.0.zip '*/.DS_Store'
```

Before you publish, make sure that `unzip` reports no errors:

```sh
unzip -t dist/octarine-v1.0.0.zip
```

An annotated tag also includes a message.
After you review the ZIP, create an annotated tag on the release commit:

```sh
git tag -a v1.0.0 -m "Octarine v1.0.0"
```

After a separate review, push `main` and the tag.
Create a release in [GitHub Releases](https://github.com/aerz/octarine-raycast/releases) with that tag.
Attach `dist/octarine-v1.0.0.zip` to the release.
Describe the commands and changes in the release notes.
Link to the installation instructions in this section.
GitHub automatically creates source archives from the tag.
