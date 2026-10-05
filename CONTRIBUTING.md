# Contributing

Develop in `main` of `aerz/octarine-raycast`. Its `raycast-store` branch contains
the committed delivery for the Store. Synchronize that delivery to
`extensions/octarine` on branch `ext/octarine` of `aerz/raycast-extensions`.

## Prepare the delivery

Commit the reviewed changes in `main` first. Create a separate worktree once:

```sh
git worktree add -b raycast-store ../octarine-raycast-store main
```

If the branch already exists, use
`git worktree add ../octarine-raycast-store raycast-store` instead.

Run the preparation script from `main`. Both worktrees must be clean, including
untracked files; ignored dependencies and build output are allowed.

```sh
npm run prepare:store -- ../octarine-raycast-store --dry-run
npm run prepare:store -- ../octarine-raycast-store
```

The script reads committed `main` and prepares `raycast-store` with `src`,
extension tests, assets, screenshots, README media, and the manifest, lockfile,
configuration, README, changelog, and license. `AGENTS.md`, `flake.nix`,
`flake.lock`, `.envrc`, both scripts, and this guide stay in `main`.
Dependencies are unchanged; the prepared manifest omits `prepare:store` and
`sync:store` and retains `publish: ray publish`.

After preparing the files, it runs `npm ci`, `npm test`, `npm run build`, and
`npm run lint` in the Store worktree. A dry run only previews file changes.
If a check fails, fix the source in `main` and commit or discard the pending
delivery changes before preparing again.

Review and commit the delivery before syncing. Record the printed source commit
in the delivery commit message. Push `raycast-store` to `origin` separately when
you want to update the remote delivery.

## Sync to the Store fork

Run the synchronization script from `main`, passing both repository roots:

```sh
npm run sync:store -- ../octarine-raycast-store /path/to/raycast-extensions --dry-run
npm run sync:store -- ../octarine-raycast-store /path/to/raycast-extensions
```

The Store and fork checkouts must be clean. The script reads only the committed
Store delivery and copies it unchanged; it rejects local tooling or an
unprepared manifest instead of filtering or transforming them.

Only `extensions/octarine` is synchronized. Obsolete tracked files there are
removed; ignored build output is preserved. Both scripts reject source symlinks
and destination paths containing symlinks. They do not stage, commit, or push.

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
