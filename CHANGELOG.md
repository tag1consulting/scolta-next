# Changelog

## [Unreleased]

## [1.0.1] - 2026-06-12

### Fixed

- **The CJS CLI was a silent no-op; `"use client"` was missing from the
  published component.** Two artifact-level breakages with one root-cause
  family each:
  - Every `import.meta.url` in the CJS bundles compiled to a property of an
    empty object, so `node dist/cli.cjs assets` exited 0 having done
    NOTHING — the direct-invoke check compared `undefined` against the argv
    URL — and a programmatic `main()` threw from `copyAssets`'s
    `createRequire(undefined)`. Root cause: the tsup build lacked the
    `import.meta` shim for the CJS format; `shims: true` derives it from
    `__filename`. New tests spawn `dist/cli.cjs` AND `dist/cli.js` as real
    child processes and assert the work product (assets actually copied),
    not the exit code — the unshimmed CJS build passes an exit-code-only
    check.
  - esbuild strips directive prologues, so the published component crashed
    App Router consumers as a server component. The component builds as its
    own sequential tsup pass with the directive re-applied as a banner,
    ESM-only to match its import-only exports condition; a dist smoke test
    pins the directive on the artifact (and its absence from the server
    entry).
- **`bin[scolta-build]` publish warning** — npm "cleaned" the bin value's
  `./` prefix at every publish; normalized via `npm pkg fix`
  (`./dist/cli.js` → `dist/cli.js`). `npm publish --dry-run` is now
  warning-free.
- **Public POST surface hardened.** `readJson` returned `any`; it now
  returns `unknown` with per-handler narrowing, and bodies whose
  Content-Length exceeds 1 MB are rejected with a 413 *before* buffering —
  `handleSummarize`'s 100k-character context check only ran after the full
  body was read.
- **JSON:API source typing + URL validation.** `JsonApiResource.attributes`
  drops `any` for `unknown` with explicit guards in the default mapping, and
  mapped URLs must be site-relative with no `..` segments — a hostile alias
  from remote JSON:API data now fails loudly naming the resource (defense in
  depth above the scolta binding's own export containment).
- **CJS consumers resolved ESM-flavoured types.** Exports now resolve
  `.d.cts` per `require` condition, with `typesVersions` for node10-style
  subpath resolution.
- **`payload` peer range declared** (`>=3`) — the existing
  `peerDependenciesMeta.optional` was a no-op without it. README tracker
  usage corrected (there is no `scoltaTracker` singleton; construct
  `ScoltaTracker`).

### Changed

- **The health Route Handler now returns status-only by default.**
  `GET /api/scolta/v1/health` previously exposed the full diagnostic payload
  (AI provider, configured flags, index state, scoring config) to every
  caller. Monitoring endpoints keep working: the handler still answers HTTP
  200 with `{"status": "ok"|"degraded"}`, computed from the full report so
  degradation stays visible. The detail moved behind the new `healthDetail`
  adapter config option (default `false`); there is no user model in a
  headless stack, so detail is config-gated rather than auth-gated. Matches
  the status-only anonymous shape of the PHP-family and Django adapters.
- eslint moved to `recommendedTypeChecked`; `noImplicitOverride` enabled;
  documented scoped exceptions (tests' unsafe-any family; Payload doc-shape
  `any` as deliberate public-API ergonomics).
- vitest 1.6 -> 3.2.6 (dev-only; pulls vite 7 / patched esbuild for the
  GHSA-67mh-4wv8-2f99 dev-server advisory).
- package metadata: `repository`/`bugs` fields added.

### Added

- **Widget-mount smoke test** — rendering `<ScoltaSearch>` under jsdom now
  asserts the container div mounts, the stylesheet/script tags inject with
  the right URLs, and the emitted `window.scolta` carries `container` + a
  `wasmPath` ending in the WASM glue module (nothing previously exercised
  the `useEffect`/DOM path).
- **CI and tag-triggered releases.** `.github/workflows/ci.yml` (PRs + main;
  Node 20/22 matrix; `npm ci`, build, test, typecheck, lint,
  `check:publish`) and `.github/workflows/release.yml` (`v*.*.*` tags publish
  to npm via OIDC Trusted Publishing — no long-lived token, automatic
  provenance).
- **Publish-shape gate.** `check:publish` runs publint +
  `@arethetypeswrong/cli`; part of the local and CI gates.

## [1.0.0] - 2026-06-09

- The `scolta` dependency now uses the published `^1.0.0` range instead of a
  local `file:../scolta-node` path, so the released tarball installs the binding
  from npm.

- Stop shipping a second copy of React: `react`/`react-dom` are peerDependencies
  (provided by the consuming app), the redundant `react` devDependency is removed
  (the build externalizes react and the tests don't import it; only
  `@types/react` is needed locally), and a package `.npmrc` sets
  `legacy-peer-deps=true` so `npm install` does not auto-install the peers here.
  A `file:`-linked install of this package resolves through its real directory,
  so a nested React would get bundled into the consumer alongside the app's own
  React and break it (e.g. Next App Router client-component prerender failing with
  "Cannot read properties of null (reading 'useContext')").
- AI Route Handlers now send the raw payload (`{terms}` / `{summary}` /
  `{response}`) on success and `{error}` on failure, instead of an `{ok,data}`
  envelope — matching what `scolta.js` reads and the Django/Laravel/Drupal
  controllers emit. (Previously the widget received the data nested under
  `data`, so AI overviews and expansion chips never rendered.)
- Default the AI service to the auto-provisioning `AmazeeAiService` when the
  resolved provider is `amazee` (free LiteLLM trial, no key required), backed by
  a filesystem credential store under the state dir.
- `fromEnv` now lets `SCOLTA_AI_PROVIDER` / `SCOLTA_API_KEY` / `SCOLTA_AI_MODEL`
  / `SCOLTA_AI_BASE_URL` override the static config, so a deployment can point AI
  at an explicit provider/key and bypass the Amazee default.
- Initial Next.js adapter: static-export crawl + content-source modes, the
  `scolta-build` CLI, AI Route Handlers, the `<ScoltaSearch />` component, the
  debounced rebuild tracker, asset vendoring, and the JSON:API/decoupled-Drupal
  worked example. Gated Payload CMS module added in a follow-up.
