import { describe, expect, it } from "vitest";
import { buildBundle } from "../../scripts/pm/build.mjs";
import { buildHtml } from "../../scripts/pm/ui.mjs";

describe("portable static twin", () => {
  it("embeds data and has no network font dependency", async () => {
    const bundle = await buildBundle({ minify: true });
    const html = buildHtml({ mode: "static", dataJson: JSON.stringify({ generatedAt: "now", files: [{ relPath: "Demo.md", raw: "# Demo", mtimeMs: 1 }] }), bundle });
    expect(html).toContain('"relPath":"Demo.md"');
    expect(html).toContain("var PM_MODE=\"static\"");
    expect(html).not.toContain("https://fonts.googleapis.com");
  });
});
