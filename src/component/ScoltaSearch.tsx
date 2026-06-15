"use client";

/**
 * <ScoltaSearch /> — a thin client component that mounts the shared vanilla-JS
 * search widget (`scolta.js`, reused verbatim by every binding). It injects the
 * stylesheet + script and sets `window.scolta` from the resolved config, then
 * renders the container the widget hydrates into. No scoring/search logic lives
 * here — that is `scolta-core` (WASM) + `scolta.js`.
 */

import { useEffect, useRef, type JSX } from "react";
import { buildWindowScolta, type BootstrapOptions } from "./bootstrap.js";

export interface ScoltaSearchProps extends BootstrapOptions {
  /** Resolved browser config (NextScoltaConfig.toBrowserConfig()). */
  config: Record<string, unknown>;
  /** Container id the widget mounts into (default "scolta-search"). */
  containerId?: string;
  className?: string;
}

function ensureStylesheet(href: string): void {
  if (document.querySelector(`link[data-scolta][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-scolta", "");
  document.head.appendChild(link);
}

function ensureScript(src: string): void {
  if (document.querySelector(`script[data-scolta][src="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.type = "module";
  script.setAttribute("data-scolta", "");
  document.body.appendChild(script);
}

export function ScoltaSearch(props: ScoltaSearchProps): JSX.Element {
  const { config, assetsPath = "/scolta", pagefindPath, containerId = "scolta-search", className } = props;
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const base = assetsPath.replace(/\/$/, "");
    (window as unknown as { scolta?: unknown }).scolta = buildWindowScolta(config, { assetsPath, pagefindPath, containerId });
    ensureStylesheet(`${base}/css/scolta.css`);
    ensureScript(`${base}/js/scolta.js`);
  }, [config, assetsPath, pagefindPath, containerId]);

  return <div id={containerId} className={className} data-scolta-search="" />;
}

export default ScoltaSearch;
