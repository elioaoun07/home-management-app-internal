import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const campaigns = ["Budget", "Schedule", "Kitchen", "Trips", "Hub & ERA", "Notifications & Alerts", "Healthcare", "Outfits", "PM Tooling", "Delivery", "Native App"];
const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    const target = resolve(fixture);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("era-pm-docs-")) throw new Error("Unexpected fixture path");
    rmSync(target, { recursive: true, force: true });
  }
});

function fixture(newline: string, omitCriteria = false) {
  const root = mkdtempSync(join(tmpdir(), "era-pm-docs-"));
  fixtures.push(root);
  for (const file of ["check-docs.mjs", "shared/links.mjs", "shared/work-id.mjs", "shared/work-lifecycle.mjs"]) {
    const destination = join(root, "scripts/pm", file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(process.cwd(), "scripts/pm", file), destination);
  }
  for (const campaign of campaigns) {
    const dir = join(root, "ERA Notes/10 - Project Management", campaign);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "4 - Checklist.md"), campaign === "Hub & ERA" ? "## Now\n- [ ] **HUB-1** Preserve input _(friction - S)_\n## Next\n## Later\n" : "## Now\n## Next\n## Later\n");
    const book = [
      `# ${campaign}`,
      "## Vision & Decisions",
      "## Pain Inventory",
      "## Acceptance Criteria Index",
      ...(campaign === "Hub & ERA" && !omitCriteria ? ["### HUB-1", "**Acceptance:** Failed capture keeps its input."] : []),
      "## Shipped Log",
      "## Delivery session log",
      "",
    ].join(newline);
    writeFileSync(join(dir, `${campaign} — Master Book.md`), book);
  }
  return join(root, "scripts/pm/check-docs.mjs");
}

describe("PM documentation checker", () => {
  it.each(["\n", "\r\n"])("accepts complete campaign books with %j line endings", (newline) => {
    const result = spawnSync(process.execPath, [fixture(newline)], { encoding: "utf8", timeout: 10_000, windowsHide: true });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("11 campaign pairs, 1 unique tasks");
  });

  it("still rejects a genuinely missing acceptance section in a CRLF book", () => {
    const result = spawnSync(process.execPath, [fixture("\r\n", true)], { encoding: "utf8", timeout: 10_000, windowsHide: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing criteria for HUB-1");
    expect(result.stderr).toContain("1 PM documentation error(s)");
  });
});
