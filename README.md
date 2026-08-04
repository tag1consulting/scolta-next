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

## Configuration

Config options are the shared binding's — the full reference is
[`scolta`'s CONFIG_REFERENCE](../scolta-node/docs/CONFIG_REFERENCE.md).

## Selecting an AI provider is always manual

Scolta ships with **no AI provider selected**. `ai_provider` (or
`SCOLTA_AI_PROVIDER`) is empty until you set it, and while it is empty AI
features are simply off: search works, no provider is assumed, and Anthropic in
particular is not silently assumed. There is no default anywhere.

This adapter has no admin UI, so **setting `ai_provider` in code or env is the
manual opt-in**. It is a going-forward rule: a deployment that already sets a
provider keeps working exactly as before.

**Amazee.ai is never enabled on its own.** Setting `ai_provider = "amazee"` is
what permits the Amazee-backed AI service to establish the free LiteLLM demo
connection on first use — an explicit choice you wrote down. With the provider
unset or set to anything else, no credential is provisioned and no outbound
Amazee call is made, on any request path. First-use provisioning is idempotent,
and an explicit `SCOLTA_API_KEY` always wins and suppresses Amazee entirely.

Amazee support is email-only, mirroring amazee.ai's own `ai_provider_amazeeio`
module: a connection is either the free demo (no email, no account) or an
amazee.ai account attached by signing in with its email address. There is no
paste-your-API-key path.

Because there is no admin UI here, there is no in-app recovery when a
connection's credit runs out: AI degrades and the health endpoint reports it.
Re-authing is an explicit ops action — set your own credentials, or run the
provisioning path again after connecting an account.

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

In `content` mode, construct a `ScoltaTracker` and call `touch(key)` on
content changes; it debounces a rebuild that reuses the token cache (gated on
`autoRebuild`):

```ts
import { ScoltaTracker } from "scolta-next";

const tracker = new ScoltaTracker(config, { rebuild: () => buildIndex(config, { source }) });
tracker.touch("post:42");
```

Serverless deployments should trigger rebuilds via webhook/CI instead.
