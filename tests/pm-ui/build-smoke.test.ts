import { describe, expect, it } from "vitest";
import { buildBundle } from "../../scripts/pm/build.mjs";
import { buildHtml } from "../../scripts/pm/ui.mjs";

describe("PM Preact bundle", () => {
  it("builds a self-contained IIFE with vendored fonts", async () => {
    const bundle = await buildBundle({ minify: true });
    expect(bundle.js.length).toBeGreaterThan(20_000);
    expect(bundle.css).toContain("data:font/woff2;base64,");
    expect(bundle.css).not.toContain("fonts.googleapis.com");
    const html = buildHtml({ mode: "static", dataJson: JSON.stringify({ files: [], probe: "</script><script>bad()</script>" }), bundle });
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain("var PM_MODE=\"static\"");
    expect(html).not.toContain("</script><script>bad()");
  });
});

