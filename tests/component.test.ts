/** Component bootstrap: window.scolta reflects config (Release Gate family 4). */

import { describe, expect, it } from "vitest";
import { buildWindowScolta } from "../src/component/bootstrap.js";
import { NextScoltaConfig } from "../src/config.js";

describe("buildWindowScolta", () => {
  it("carries the resolved browser config through", () => {
    const config = NextScoltaConfig.fromObject({ site_name: "Acme", results_per_page: 8 });
    const win = buildWindowScolta(config.toBrowserConfig());
    expect(win["siteName"]).toBe("Acme");
    expect((win["scoring"] as any)["RESULTS_PER_PAGE"]).toBe(8);
    expect(win["endpoints"]).toBeTruthy();
  });

  it("overrides pagefindPath + derives wasmPath from assetsPath", () => {
    const win = buildWindowScolta({ pagefindPath: "/pagefind/pagefind.js" }, { assetsPath: "/scolta/", pagefindPath: "/custom/pagefind.js" });
    expect(win["pagefindPath"]).toBe("/custom/pagefind.js");
    expect(win["wasmPath"]).toBe("/scolta/wasm/");
  });
});
