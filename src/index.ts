/**
 * scolta-next — Scolta adapter for Next.js.
 *
 * Server-side surface. The React component is exported from `scolta-next/component`
 * (it is a client component) and the gated Payload module from `scolta-next/payload`.
 */

export * from "./config.js";
export * from "./content-source.js";
export * from "./jsonapi-source.js";
export * from "./build.js";
export * from "./route-handlers.js";
export * from "./tracker.js";
export * from "./assets.js";
export { buildWindowScolta, type BootstrapOptions } from "./component/bootstrap.js";
