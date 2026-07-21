# Changelog

## [Unreleased]

### Fixed

- **`scolta-build assets` now copies the consuming project's `scolta` runtime
  assets, not this adapter's nested copy.** `resolveScoltaAssetsDir` resolved
  `scolta/package.json` relative to the CLI module's own location, so when the
  adapter carried its own nested `node_modules/scolta` (it always does — `scolta`
  is a dependency), the resolver found the adapter-nested version instead of the
  project's. If the two installs were at different versions, `scolta-build
  assets` silently copied stale WASM/JS into the site even when the project
  itself was on the right version. Resolution now prefers the `scolta` installed
  in the cwd where `scolta-build` runs and only falls back to the module-relative
  copy. Added a resolver unit test asserting project resolution wins.

## [1.0.1] - 2026-07-10

### Added

- **Pack-content guard in CI** (`check:pack`). Asserts every path in
  `npm pack --dry-run --json` matches an allowlist derived from package.json's
  own `files` field (plus the always-included `package.json`), and that the
  unpacked size stays under a ~2x cap of the measured good artifact
  (229,689 bytes → 460,000-byte cap). The `files` field is already a
  fail-closed publish allowlist; this is the regression test that keeps it
  true. Failures print the leaked path and point at the filter. Runs locally
  via `npm run check:pack`.
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

### Changed

- Document where config options are defined: link the binding's
  CONFIG_REFERENCE from the README (new `## Configuration` section).
- **The release workflow now runs the publish-surface guards before
  `npm publish` (`.github/workflows/release.yml`).** `check:publish` (publint +
  are-the-types-wrong) and `check:pack` (pack-content allowlist + size cap)
  gated only `ci.yml` on PRs, never the release workflow that actually
  publishes — so a tagged commit could ship a tarball the PR gate would have
  rejected. Both now run after `build`/`test` and before `npm publish`, gating
  the published tarball the same way CI gates PRs.
- **The CJS regression test now actually runs in CI.** The direct-invoke case
  in `tests/cjs-build.test.ts` is `skipIf`-gated on the resolved `scolta`
  version (the binding's CJS `require()` crash is only fixed in scolta
  ≥ 1.0.1), but CI installed the registry `scolta@1.0.0` and the guard went
  TRUE — so the test this package carries for the silent-no-op bug never
  executed and CI was green without exercising it. CI now checks out
  scolta-node `main` (the unreleased 1.0.1 fix), builds it, and links it as the
  workspace `scolta` after `npm ci` (the lockfile stays registry-resolved, per
  the no-`link:` rule), so the guard is false and the test runs. The `skipIf`
  is kept as a genuine capability guard; this dev-resolution link is dropped
  once scolta-node 1.0.1 is published and the dep floor rises to `^1.0.1`
  (TS release track).
- Align the React type packages with the React 19 runtime: `@types/react` and
  `@types/react-dom` move to the `^19` line, matching the `react`/`react-dom` 19
  the build and jsdom test already resolve. `@types/react-dom` is now a direct
  devDependency (previously only a transitive optional peer). React 19 scopes
  the global `JSX` namespace into the `react` module, so the client component
  imports `type JSX` from `react`.
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

### Fixed

- **JSON:API resource-URL validation now runs for custom `mapResource`
  implementations, not only the default map.** The hostile-alias / non-relative
  URL guard (`validateResourceUrl`) was invoked only inside `defaultMap`, so any
  consumer supplying `options.mapResource` (the common case — field mapping is
  site-specific) silently lost the defense, and CI stayed green because the
  existing tests exercised only the default map. `enumerate()` now validates
  every mapped item's URL, so traversal segments are rejected regardless of
  which map produced the item. `defaultMap` keeps its own pre-normalization
  check, which also rejects absolute/non-relative URLs before they are
  normalized to a path.
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
  (`./dist/cli.js` → `dist/cli.js`). `npm publish --dry-run` no longer
  warns.
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
- Default the AI service to the auto-configuring `AmazeeAiService` when the
  resolved provider is `amazee` (managed LiteLLM endpoint via Amazee.ai, no key
  required), backed by a filesystem credential store under the state dir.
- `fromEnv` now lets `SCOLTA_AI_PROVIDER` / `SCOLTA_API_KEY` / `SCOLTA_AI_MODEL`
  / `SCOLTA_AI_BASE_URL` override the static config, so a deployment can point AI
  at an explicit provider/key and bypass the Amazee default.
- Initial Next.js adapter: static-export crawl + content-source modes, the
  `scolta-build` CLI, AI Route Handlers, the `<ScoltaSearch />` component, the
  debounced rebuild tracker, asset vendoring, and the JSON:API/decoupled-Drupal
  worked example. Gated Payload CMS module added in a follow-up.
