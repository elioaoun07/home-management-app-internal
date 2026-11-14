// Run fixtures/a5-browser.mjs --launchpad --arena first. The isolated server
// supplies the app shell. Setup facts come from the current read-only scan.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { check } from "../../scripts/os/check.mjs";

const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const fixture = JSON.parse(
  readFileSync(".pm/a5-evidence/fixture.json", "utf8"),
);
assert.equal(
  new URL(base).origin,
  new URL(fixture.url).origin,
  "use the isolated fixture URL",
);
const sourceFiles = readdirSync("scripts/pm/app")
  .filter(
    (name) =>
      /^setup/i.test(name) || ["cockpit.css", "cockpitTypes.ts"].includes(name),
  )
  .map((name) => `scripts/pm/app/${name}`);
const candidate = sourceFiles.map((path) => {
  const digest = (root) =>
    createHash("sha256")
      .update(readFileSync(join(root, path)))
      .digest("hex");
  const hash = digest(process.cwd());
  assert.equal(
    digest(fixture.root),
    hash,
    `${path} must match the fixture runtime`,
  );
  return { path, sha256: hash };
});
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const page = await browser.newPage({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const evidence = process.env.ERA_SETUP_EVIDENCE || ".pm/setup-evidence";
mkdirSync(evidence, { recursive: true });
const current = check(process.cwd());
assert.ok(current.setup.entities.some((entry) => entry.id === "HR-22"));
const errors = [],
  writes = [],
  external = [];
let scenario = "current";
const syntheticConflicts = [
  {
    code: "MIRROR",
    severity: "error",
    source: "CLAUDE.md",
    related: "AGENTS.md",
    message: "Fixture instruction mirror is out of date",
  },
  {
    code: "PARITY",
    severity: "warning",
    source: ".claude/skills/start-task/SKILL.md",
    related: ".agents/skills/start-task/SKILL.md",
    message: "Fixture agent skill is unavailable",
  },
  {
    code: "BASELINE",
    severity: "info",
    source: "scripts/os/detectors/hr22.mjs",
    message: "Fixture baseline contains 3 recorded violations",
  },
];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") {
    external.push(url.hostname);
    return route.abort();
  }
  if (!["GET", "HEAD"].includes(request.method())) {
    writes.push(url.pathname);
    return route.abort();
  }
  if (url.pathname !== "/api/data") return route.continue();
  const response = await route.fetch();
  const data = await response.json();
  assert.ok(data.cockpit, "isolated cockpit fixture");
  data.cockpit.setup = structuredClone(current.setup);
  data.cockpit.conflicts = structuredClone(current.rows);
  data.cockpit.pending = false;
  data.cockpit.stale = scenario === "stale";
  data.cockpit.warnings = [];
  if (scenario === "conflicts") data.cockpit.conflicts = syntheticConflicts;
  if (scenario === "info") data.cockpit.conflicts = [syntheticConflicts[2]];
  if (["disabled", "missing"].includes(scenario)) {
    data.cockpit.conflicts = [];
    const rule = data.cockpit.setup.entities.find(
      (entry) => entry.id === "HR-22",
    );
    assert.ok(rule.enforcedBy.length, "current HR-22 has declared checks");
    if (scenario === "disabled") {
      for (const entry of data.cockpit.setup.entities)
        if (rule.enforcedBy.includes(entry.id)) entry.disabled = true;
    } else {
      data.cockpit.setup.entities = data.cockpit.setup.entities.filter(
        (entry) => !rule.enforcedBy.includes(entry.id),
      );
    }
  }
  if (scenario === "unavailable") {
    data.cockpit.setup = null;
    data.cockpit.warnings = ["Fixture setup scan unavailable"];
  }
  return route.fulfill({ response, json: data });
});
const open = async (path, reload = false) => {
  await page.goto(`${base}#/${path}`);
  if (reload) await page.reload();
  await page.locator("main").waitFor();
};
const capture = async (name) => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} has no horizontal overflow`,
  );
  await page.screenshot({
    path: `${evidence}/${name}.png`,
    animations: "disabled",
    fullPage: true,
  });
};
const ruleCard = (id) => page.locator(`[data-rule="${id}"]`);

try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      await open("setup");
      await page.getByRole("heading", { name: "Setup", exact: true }).waitFor();
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      const nav = page.getByRole("navigation", { name: "Setup tabs" });
      for (const name of ["Overview", "Rule coverage", "Configuration"])
        assert.ok(
          await nav.getByRole("link", { name, exact: true }).isVisible(),
        );
      assert.ok(
        await nav.getByRole("link", { name: /^Conflicts/ }).isVisible(),
      );
      const hardRules = current.setup.entities.filter(
        (entry) => /^HR-\d+$/.test(entry.id) && !entry.retired,
      );
      const coverageCounts = await page
        .locator(".setup-coverage-row strong")
        .allTextContents();
      assert.equal(
        coverageCounts.reduce((total, count) => total + Number(count), 0),
        hardRules.length,
        "coverage accounts for every hard rule once",
      );
      await capture(`overview-${width}-${theme}`);

      await nav
        .getByRole("link", { name: "Configuration", exact: true })
        .click();
      await page.getByLabel("Search setup").waitFor();
      assert.equal(await page.locator(".setup-map").isVisible(), false);
      const entries = page.locator(".setup-entry");
      const originalCount = await entries.count();
      assert.ok(originalCount > 2, "configuration has actual skill inventory");
      await entries.first().click();
      assert.equal(
        await entries.count(),
        originalCount,
        "opening details preserves inventory",
      );
      await page.getByLabel("Search setup").fill("start-task");
      const matchingCount = await entries.count();
      assert.ok(matchingCount > 0 && matchingCount < originalCount);
      await entries.first().click();
      assert.equal(
        await entries.count(),
        matchingCount,
        "opening details preserves search results",
      );
      assert.equal(
        await page.getByLabel("Search setup").inputValue(),
        "start-task",
      );
      await page.getByLabel("Search setup").fill("");
      await page.getByLabel("Setup category").selectOption("1");
      assert.ok(
        (await entries.count()) > 0,
        "category remains usable after selection",
      );
      await page.getByLabel("Setup category").selectOption("2");
      await page.locator(".agent-card").filter({ hasText: "claude" }).click();
      const agentCount = await entries.count();
      assert.ok(agentCount > 0 && agentCount <= originalCount);
      await entries.first().click();
      assert.equal(
        await entries.count(),
        agentCount,
        "detail selection preserves agent filter",
      );
      await page
        .getByRole("button", { name: "All agents", exact: true })
        .click();
      assert.equal(
        await entries.count(),
        originalCount,
        "all agents restores the complete inventory",
      );
      await capture(`configuration-${width}-${theme}`);
      await page.getByText("Connection map", { exact: true }).click();
      assert.ok(await page.locator(".setup-map").isVisible());
      await capture(`connections-${width}-${theme}`);

      await open("setup?tab=rulebook");
      await page.getByLabel("Rule coverage filter").selectOption("manual");
      await page.getByLabel("Search rules").fill("HR-4");
      await ruleCard("HR-4").waitFor();
      assert.equal(
        await ruleCard("HR-4").getAttribute("data-coverage"),
        "documented",
      );
      await ruleCard("HR-4")
        .getByText("Checks & evidence", { exact: true })
        .click();
      await ruleCard("HR-4")
        .getByRole("heading", { name: "Review steps", exact: true })
        .waitFor();
      assert.ok(
        (
          await ruleCard("HR-4").locator(".setup-review-steps p").innerText()
        ).trim().length > 0,
      );
      await capture(`manual-rule-${width}-${theme}`);
      await open("setup?tab=rulebook");
      await page.getByLabel("Rule coverage filter").selectOption("automated");
      await page.getByLabel("Search rules").fill("HR-22");
      await ruleCard("HR-22").waitFor();
      assert.equal(
        await ruleCard("HR-22").getAttribute("data-coverage"),
        "checked",
      );
      await ruleCard("HR-22")
        .getByText("Checks & evidence", { exact: true })
        .click();
      assert.ok(
        (await ruleCard("HR-22").locator(".setup-guard-list code").count()) > 0,
      );
      await capture(`checked-rule-${width}-${theme}`);
      await open("setup?tab=conflicts");
      await capture(`conflicts-${width}-${theme}`);
    }
  }

  const moduleRule = current.setup.entities.find(
    (entry) => entry.kind === "rule" && /^MR-/.test(entry.id) && !entry.retired,
  );
  assert.ok(moduleRule, "current scan includes module rules");
  await open(`setup?tab=rulebook&rule=${encodeURIComponent(moduleRule.id)}`);
  await ruleCard(moduleRule.id).waitFor();
  await ruleCard(moduleRule.id)
    .getByText("Checks & evidence", { exact: true })
    .click();
  assert.ok(
    (await ruleCard(moduleRule.id).innerText()).includes(moduleRule.source),
  );
  await capture("module-rule-390-pink");

  scenario = "conflicts";
  await open("setup?tab=conflicts", true);
  await page
    .getByText(syntheticConflicts[0].message, { exact: true })
    .waitFor();
  await page
    .getByText(syntheticConflicts[1].message, { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByText(syntheticConflicts[2].message, { exact: true })
      .isVisible(),
    false,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Capture issue", exact: true })
      .count(),
    2,
  );
  await page.locator(".setup-notes > summary").click();
  await page.locator(".setup-notes .setup-conflict > summary").click();
  await page
    .getByText(syntheticConflicts[2].message, { exact: true })
    .waitFor();
  await capture("actionable-conflicts-390-pink");

  for (const condition of ["disabled", "missing"]) {
    scenario = condition;
    await open("setup", true);
    await page.getByRole("link", { name: /HR-22/ }).first().waitFor();
    await page.getByRole("link", { name: /HR-22/ }).first().click();
    await ruleCard("HR-22").waitFor();
    assert.equal(
      await ruleCard("HR-22").getAttribute("data-coverage"),
      "missing",
    );
    assert.ok((await page.locator(".setup-attention-dot").count()) > 0);
    await ruleCard("HR-22")
      .getByText("Checks & evidence", { exact: true })
      .click();
    await ruleCard("HR-22")
      .getByText(condition === "disabled" ? "Disabled" : "Guard missing", {
        exact: true,
      })
      .first()
      .waitFor();
    await capture(`${condition}-guard-390-pink`);
  }

  scenario = "info";
  await open("setup", true);
  assert.equal(await page.locator(".setup-attention-dot").count(), 0);
  await capture("information-only-390-pink");
  scenario = "stale";
  await open("setup", true);
  await page.getByText("Saved setup snapshot", { exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Saved setup status", exact: true })
    .waitFor();
  await capture("saved-snapshot-390-pink");
  scenario = "unavailable";
  await open("setup", true);
  await page
    .getByRole("heading", { name: "Setup unavailable", exact: true })
    .waitFor();
  await capture("unavailable-390-pink");

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(external, []);
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        ok: true,
        widths: [1440, 390],
        themes: ["blue", "pink"],
        setupFingerprint: current.setup.fingerprint,
        candidate,
        currentConflicts: current.rows.reduce((counts, row) => {
          counts[row.severity] = (counts[row.severity] || 0) + 1;
          return counts;
        }, {}),
        selectionPreservesSearch: true,
        selectionPreservesInventory: true,
        disabledAndMissingGuards: true,
        informationOnly: true,
        staleAndUnavailable: true,
        errors,
        writes,
        external,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Setup browser PASS with current scan, desktop/mobile Blue/Pink, independent configuration selection, disabled/missing guards, conflict severity and unavailable evidence; zero writes.\n",
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.txt`,
    `${error.stack}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await browser.close();
}
