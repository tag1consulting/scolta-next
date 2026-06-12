// @vitest-environment jsdom
/**
 * Widget-mount smoke test (mandated for browser-mounting adapters): rendering
 * <ScoltaSearch> must produce the container div scolta.js hydrates into,
 * inject the stylesheet + script tags, and emit a window.scolta whose
 * `container` and `wasmPath` let the widget actually boot.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoltaSearch } from "../src/component/ScoltaSearch.js";
import { NextScoltaConfig } from "../src/config.js";

afterEach(() => {
  cleanup();
  delete (window as unknown as { scolta?: unknown }).scolta;
  document.head.querySelectorAll("[data-scolta]").forEach((el) => el.remove());
  document.body.querySelectorAll("script[data-scolta]").forEach((el) => el.remove());
});

describe("<ScoltaSearch> mount", () => {
  it("renders the container and injects the script/link tags", () => {
    const config = NextScoltaConfig.fromObject({ site_name: "Mount Site" });
    const { container } = render(<ScoltaSearch config={config.toBrowserConfig()} />);

    expect(container.querySelector("#scolta-search")).not.toBeNull();
    const link = document.head.querySelector('link[data-scolta][rel="stylesheet"]');
    expect(link?.getAttribute("href")).toBe("/scolta/css/scolta.css");
    const script = document.body.querySelector("script[data-scolta]");
    expect(script?.getAttribute("src")).toBe("/scolta/js/scolta.js");
    expect(script?.getAttribute("type")).toBe("module");
  });

  it("emits window.scolta with the container and the WASM glue-module path", () => {
    const config = NextScoltaConfig.fromObject({ site_name: "Mount Site" });
    render(<ScoltaSearch config={config.toBrowserConfig()} />);

    const scolta = (window as unknown as { scolta?: Record<string, unknown> }).scolta;
    expect(scolta).toBeTruthy();
    expect(scolta!["container"]).toBe("#scolta-search");
    expect(String(scolta!["wasmPath"]).endsWith("/wasm/scolta_core.js")).toBe(true);
    expect(scolta!["siteName"]).toBe("Mount Site");
  });

  it("honours containerId and assetsPath props", () => {
    const config = NextScoltaConfig.fromObject({});
    const { container } = render(
      <ScoltaSearch config={config.toBrowserConfig()} containerId="my-search" assetsPath="/static/scolta" />,
    );

    expect(container.querySelector("#my-search")).not.toBeNull();
    const scolta = (window as unknown as { scolta?: Record<string, unknown> }).scolta;
    expect(scolta!["container"]).toBe("#my-search");
    expect(scolta!["wasmPath"]).toBe("/static/scolta/wasm/scolta_core.js");
  });
});
