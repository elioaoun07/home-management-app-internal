import { describe, expect, it } from "vitest";
import { buildApp } from "../../scripts/pm/app-build.mjs";
import { appAsset, buildAppShell } from "../../scripts/pm/app-shell.mjs";
describe("standalone React application", () => {
  it("boots separate local assets without embedding a backlog snapshot or remote dependencies", async () => {
    const bundle = await buildApp();
    const html = buildAppShell();
    expect(html).toContain('type="module"');
    expect(html).not.toContain("PM_DATA");
    expect(html).not.toContain("http");
    expect(appAsset("/app/assets/pm.js", bundle)?.body).toBe(bundle.js);
    expect(appAsset("/app/assets/pm.css", bundle)?.type).toContain("text/css");
    expect(appAsset("/app/assets/../../secret", bundle)).toBeNull();
    expect(bundle.css).toContain("data:font/woff2;base64,");
    expect(bundle.css).toContain("prefers-reduced-motion");
    expect(bundle.js).not.toContain("https://esm.sh");
  });
});
