# scolta-next

Scolta adapter for **Next.js** — AI-powered [Pagefind](https://pagefind.app)
search, on top of the [`scolta`](../scolta-node) binding. Ships a gated
[Payload CMS](https://payloadcms.com) module (`scolta-next/payload`).

## Content modes

Set `source` in your config:

- **`static-export`** (default) — for `output: 'export'` sites. After `next
  build`, `npx scolta-build` crawls the rendered HTML in `out/` and writes the
  index. Search works fully static.

  > **AI tier in static export:** a pure static site has no server, so POST
  > Route Handlers are **not** included. Search is unaffected; the AI tier
  > (expand/summarize/follow-up) requires an externally hosted endpoint — point
  > `window.scolta.endpoints` at it — or running the site in server mode. This
  > is a real limitation, documented honestly, not a workaround.

- **`content`** — for server/hybrid sites. Register a content source (an async
  iterable of `ContentItem`s + a cheap `changed-since` check so unchanged
  entries yield `CachedContentReference` and hit the token cache). CMS-agnostic.
  - **Headless Node CMS (Payload):** the built first-class module (`scolta-next/payload`).
  - **Decoupled Drupal / JSON:API (`next-drupal`):** the highest-demand case.
    If the Next site is statically exported, `static-export` mode already indexes
    the rendered Drupal content with **no Drupal-specific code**. For server mode,
    `JsonApiContentSource` is a documented worked example (a `fetch`-based async
    iterable over a Drupal JSON:API endpoint with a `changed-since` check).

## AI endpoints

Mount the ready-made Route Handlers at the exact paths `scolta.js` defaults to:

```ts
// app/api/scolta/v1/expand-query/route.ts
import { createScoltaRouteHandlers, NextScoltaConfig } from "scolta-next";
const h = createScoltaRouteHandlers(NextScoltaConfig.fromEnv());
export const POST = h.expandQuery;
```

…and likewise `summarize` / `followup` (POST) and `health` (GET).

### Health endpoint

`GET /health` returns `{"status": "ok"|"degraded"}` — enough for uptime
monitors. The full diagnostic payload (provider, index state, scoring config)
is exposed only with `healthDetail: true` in the adapter config. There is no
user model in a headless stack, so detail is config-gated rather than
auth-gated; enable it only where the endpoint is not publicly reachable.

## Search widget

```tsx
import { ScoltaSearch } from "scolta-next/component";
<ScoltaSearch config={config.toBrowserConfig()} />
```

Run `npx scolta-build assets` once to copy the vendored bundle into
`public/scolta/`; the index is written under `public/pagefind/`.

## CLI

```sh
npx scolta-build            # fresh build (postbuild)
npx scolta-build --force    # ignore the token cache
npx scolta-build --resume   # resume an interrupted build
npx scolta-build --restart  # discard transient state
npx scolta-build assets     # copy runtime assets into public/
```

## Auto-rebuild

In `content` mode, `scoltaTracker.touch(key)` debounces a rebuild that reuses
the token cache (gated on `autoRebuild`). Serverless deployments should trigger
rebuilds via webhook/CI instead.
