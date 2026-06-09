# Changelog

## Unreleased

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
