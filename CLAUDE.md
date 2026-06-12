# scolta-next — conventions

Thin Next.js adapter over the `scolta` binding (`../scolta-node`). It adds ONLY
framework glue — content modes, the build CLI, AI Route Handlers, the React
mount component, and the debounced rebuild tracker. It NEVER reimplements
scoring, HTML cleaning, indexing, tokenizing, or prompt logic — all of that is
in `scolta` and is shared. If you find yourself porting binding logic here, stop.

- Server surface: `scolta-next`. Client component: `scolta-next/component`
  (carries "use client"). Gated CMS module: `scolta-next/payload`.
- `scolta` resolves from the npm registry (the lock must stay
  registry-resolved — a `link:` entry breaks CI installs). For local
  development against the sibling, build scolta-node and symlink manually:
  `ln -s ../../scolta-node node_modules/scolta` (any npm install/ci replaces
  it; re-create afterwards).
- No AI attribution anywhere. Tests are vitest; Route Handlers are tested
  directly against Web `Request`/`Response` (no Next runtime needed).
