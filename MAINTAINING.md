# MAINTAINING — scolta-next

The Next.js adapter over the `scolta` binding. Publishes to npm.

Everything true of more than one Scolta repo lives in
[scolta-core/MAINTAINING.md](https://github.com/tag1consulting/scolta-core/blob/main/MAINTAINING.md):
the version rules, the release order, the fleet checks, the rules every repo shares.

**What it is.** A Next.js adapter, framework glue only: content modes, the build CLI, the AI Route
Handlers, the React mount component and the rebuild tracker. It depends on `scolta` (the repo is
`scolta-node`) and never on `scolta-core` directly.

**Where the version lives.** `package.json`.

**Where it publishes.** npm, as `scolta-next`. To confirm: `npm install scolta-next` in a throwaway
directory resolves it. The entry points are `scolta-next` (server), `scolta-next/component` (the client
component, which carries "use client") and `scolta-next/payload` (the gated CMS module).

**CI checks.** One `test` job across Node 20 and 22, running `npm run build`, `npm test` (vitest),
`npm run typecheck`, `npm run lint`, `npm run check:publish` and `npm run check:pack`. Route Handlers are
tested directly against Web `Request`/`Response`, so no Next runtime is needed.

**On release day.** Release this after scolta-node. Tag `vX.Y.Z`; the release workflow publishes through
Trusted Publishing (OIDC), which attaches provenance automatically.

**Watch out for.**

- **CI currently builds scolta-node from `main` and symlinks it over the installed `scolta`.** The
  registry pin resolves a published version whose CJS entry crashes at `require()`, which is exactly what
  the `cjs-build` regression test guards, and its skip condition goes true on that version so the test
  never runs. The step is a workaround with an expiry: drop it once a fixed `scolta` is published and the
  dependency floor is bumped. Until then, a green run here is not a statement about the published
  binding.
- The lockfile must stay registry-resolved: a `link:` entry breaks `npm ci`, so the symlink is applied
  after `npm ci` rather than recorded in the lock. For local development against the sibling, build
  scolta-node and `ln -s ../../scolta-node node_modules/scolta` by hand, re-creating it after any
  install.
- The `file:` dependency trap: the published manifest must carry a semver, never a `file:` path.
  `check:pack` is what catches a leftover.
- This package carries no copy of the browser bundle; it comes from `scolta`.
- npm is pinned to the exact version that generated the lockfile. Bump the pin in `ci.yml` and
  `release.yml` together.
