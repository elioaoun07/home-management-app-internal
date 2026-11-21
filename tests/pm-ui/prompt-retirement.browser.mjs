// R127: isolated browser facts only. Never invokes a provider or Start.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  chromiumExecutable,
  fixtureAssets,
  sourceSnapshot,
} from "./fixtures/local-stage-board.mjs";

const evidence = process.env.ERA_PROMPT_RETIREMENT_EVIDENCE || ".pm/r127-evidence";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const origin = new URL(assets.base).origin;
const response = await fetch(new URL("/api/data", assets.base));
assert.equal(response.status, 200, "isolated fixture data is available");
const baseline = await response.json();
assert.ok(baseline.cockpit?.setup && Array.isArray(baseline.files));
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const executablePath = chromiumExecutable();
assert.ok(executablePath, "installed Chromium is required");
const browser = await chromium.launch({ headless: true, executablePath });
const profiles = [
  { width: 1280, height: 640, dpr: 1 },
  { width: 1358, height: 696, dpr: 1.65 },
  { width: 1494, height: 934, dpr: 1.5 },
  { width: 390, height: 844, dpr: 1 },
];
const at = "2026-11-14T13:42:00.000Z";
const since = "2026-11-15T06:39:25.775Z";
const skillNames = ["start-task", "fix-bug", "ui-guardrails"];
const checks = [], captures = [], errors = [], writes = [], legacyRequests = [], readinessReads = [];

function fixtureData(scenario) {
  const data = structuredClone(baseline);
  data.cockpit = { ...data.cockpit, pending: false, stale: false, conflicts: [], warnings: [] };
  data.cockpit.setup.entities = [
    ...data.cockpit.setup.entities.filter((entity) => entity.kind !== "skill"),
    ...skillNames.map((name) => ({ id: `skill:fixture:${name}`, kind: "skill", name,
      source: `.claude/skills/${name}/SKILL.md`, agents: ["claude", "codex"] })),
  ];
  data.cockpit.skillUsage = {
    available: ["known20", "known19"].includes(scenario),
    recordedSessions: scenario === "known19" ? 19 : 20,
    skills: [{ name: "start-task", lastUsed: at, sessions: 7 }, { name: "fix-bug", lastUsed: null, sessions: 0 }],
  };
  if (scenario === "unknown") delete data.cockpit.recorder;
  else data.cockpit.recorder = scenario === "unavailable"
    ? { state: "unavailable", since }
    : { state: "recording", since: null };
  return data;
}

async function install(context, theme) {
  const state = { scenario: "known20" };
  await context.addInitScript((theme) => {
    localStorage.setItem("pm-app-theme", theme);
    localStorage.setItem("pm-game-layer", "off");
  }, theme);
  await context.route("**/*", (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!["GET", "HEAD"].includes(request.method())) {
      writes.push({ path: url.pathname, method: request.method() });
      return route.abort();
    }
    if (url.pathname.startsWith("/api/launchpad")) {
      legacyRequests.push(url.pathname);
      return route.abort();
    }
    if (url.pathname.includes("/readiness")) {
      readinessReads.push(url.pathname);
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fixture readiness is not invoked"}' });
    }
    const json = (value) => route.fulfill({ contentType: "application/json", body: JSON.stringify(value) });
    if (url.pathname === "/app/assets/pm.js") return route.fulfill({ contentType: "text/javascript", body: assets.bundle.js });
    if (url.pathname === "/app/assets/pm.css") return route.fulfill({ contentType: "text/css", body: assets.bundle.css });
    if (url.pathname === "/api/data") return json(fixtureData(state.scenario));
    if (url.pathname === "/api/delivery/v2/session") return json({ paired: true, actor: "synthetic-fixture", csrf: "no-writes" });
    if (url.pathname === "/api/delivery/sessions") return json({ sessions: [] });
    if (url.pathname === "/api/delivery/v2/runs") return json({ runs: [], requests: [] });
    if (url.pathname === "/api/delivery/v2/uat") return json({ handovers: [] });
    if (url.pathname === "/api/delivery/v2/queue") return json({ queue: { running: [], waiting: [], decisions: [], candidates: [], applying: null, unknown: { jobs: [] } } });
    return route.continue();
  });
  return state;
}

let sequence = 0;
async function open(page, path) {
  await page.goto(`${assets.base}?retirement-fixture=${++sequence}#/${path}`);
  await page.locator("main").waitFor();
}

async function skills(page, scenario = "known20") {
  await open(page, "setup?tab=configuration");
  // Use the public tab link: Configuration's internal route label may change.
  const nav = page.getByRole("navigation", { name: "Setup tabs", exact: true });
  await nav.getByRole("link", { name: "Configuration", exact: true }).click();
  await page.getByLabel("Setup category", { exact: true }).selectOption({ label: "Skills" });
  await page.getByRole("table", { name: "Skill use", exact: true }).waitFor();
  await page.waitForFunction((scenario) => {
    const used = document.querySelector('[data-skill="start-task"]')?.closest("tr")
      ?.querySelector(".setup-skill-sessions")?.textContent.trim();
    return used === (["known20", "known19"].includes(scenario) ? "7" : "—") &&
      document.querySelectorAll(".setup-skill-unused").length === (scenario === "known20" ? 2 : 0);
  }, scenario);
}

const row = (page, name) => page.locator(".setup-skills tbody tr")
  .filter({ has: page.locator(`[data-skill="${name}"]`) });

async function capture(page, name) {
  const dimensions = await page.evaluate(() => ({ innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  assert.ok(dimensions.scrollWidth <= dimensions.innerWidth, `${name}: no horizontal page overflow`);
  const path = `${evidence}/${name}.png`;
  await page.screenshot({ path, animations: "disabled", fullPage: true });
  captures.push({ name, path, ...dimensions });
}

let activePage;
try {
  assert.equal(Object.hasOwn(assets.sourceFacts, "scripts/pm/app/Launchpad.tsx"), false, "retired component is outside the bundle source set");
  assert.equal(Object.hasOwn(assets.sourceFacts, "scripts/pm/app/launchpad.css"), false);
  assert.equal(assets.bundle.js.includes("Prompt tools"), false, "retired navigation label is absent from app code");
  assert.equal(assets.bundle.css.includes(".launchpad"), false, "no retired page stylesheet remains");
  for (const profile of profiles) for (const theme of ["blue", "pink"]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, serviceWorkers: "block", reducedMotion: "reduce" });
    const state = await install(context, theme);
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => errors.push(error.message));
    const key = `${profile.width}-${theme}`;
    for (const path of ["skill-tools", "launch"]) {
      await open(page, path);
      await page.getByLabel("Find work", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, "#/explore?lane=now");
      assert.equal(await page.getByLabel("Prompt", { exact: true }).count(), 0);
      assert.equal(await page.locator('[class*="launchpad"]').count(), 0);
    }
    await capture(page, `retired-routes-${key}`);
    await open(page, "launch?file=Budget%2F4%20-%20Checklist.md&cb=0");
    await page.getByLabel(/Executor/u).waitFor();
    await page.getByRole("button", { name: "Start", exact: true }).waitFor();
    assert.match(new URL(page.url()).hash, /^#\/launch\?file=/u, "contextual launch remains Delivery");
    await capture(page, `contextual-delivery-${key}`);
    await skills(page);
    assert.equal(await page.getByText("Prompt tools", { exact: true }).count(), 0);
    assert.deepEqual(await page.locator(".setup-skills th").allTextContents(), ["Skill", "Last used", "Sessions"]);
    assert.equal(await row(page, "start-task").locator("time").getAttribute("datetime"), at);
    assert.equal(await row(page, "start-task").locator(".setup-skill-last-used").innerText(), "2026-11-14");
    assert.equal(await row(page, "start-task").locator(".setup-skill-sessions").innerText(), "7");
    assert.equal(await row(page, "start-task").locator(".setup-skill-unused").count(), 0);
    for (const name of ["fix-bug", "ui-guardrails"]) {
      assert.equal(await row(page, name).locator(".setup-skill-last-used").innerText(), "—");
      assert.equal(await row(page, name).locator(".setup-skill-sessions").innerText(), "0");
      assert.equal(await row(page, name).locator(".setup-skill-unused").innerText(), "Unused");
    }
    await capture(page, `skills-known20-${key}`);
    const search = page.getByLabel("Search setup", { exact: true });
    await search.fill("start-task");
    const skill = page.locator('[data-skill="start-task"]');
    await skill.focus();
    await page.keyboard.press("Enter");
    assert.equal(await skill.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(".setup-selection > summary").innerText(), "start-task");
    assert.equal(await search.inputValue(), "start-task");
    await search.fill("");
    assert.equal(await page.locator(".setup-skills tbody tr").count(), 3, "keyboard detail preserves inventory");
    for (const scenario of ["known19", "unavailable", "unknown"]) {
      state.scenario = scenario;
      await skills(page, scenario);
      assert.equal(await page.locator(".setup-skill-unused").count(), 0, `${scenario}: no unsupported Unused tag`);
      if (scenario === "known19") {
        assert.equal(await row(page, "fix-bug").locator(".setup-skill-sessions").innerText(), "0");
      } else for (const name of skillNames) {
        assert.equal(await row(page, name).locator(".setup-skill-last-used").innerText(), "—");
        assert.equal(await row(page, name).locator(".setup-skill-sessions").innerText(), "—");
      }
      await capture(page, `skills-${scenario}-${key}`);
    }
    checks.push({ profile, theme, routesRetired: true, contextualDelivery: true, recordedUse: true, unusedThreshold: 20, unavailableWithheld: true, keyboard: true });
    await context.close();
    activePage = null;
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(legacyRequests, []);
  assert.deepEqual(readinessReads, []);
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${evidence}/retirement-failure.png`, fullPage: true });
    writeFileSync(`${evidence}/retirement-failure.txt`, `${error.stack}\n${await activePage.locator("body").innerText()}`);
  }
  throw error;
} finally {
  const finalSourceFacts = sourceSnapshot();
  const changedSources = [...new Set([...Object.keys(assets.sourceFacts), ...Object.keys(finalSourceFacts)])].filter((path) => assets.sourceFacts[path]?.sha256 !== finalSourceFacts[path]?.sha256);
  writeFileSync(`${evidence}/retirement-result.json`, JSON.stringify({ ok: checks.length === profiles.length * 2 && !errors.length && !writes.length && !legacyRequests.length && !readinessReads.length && !changedSources.length, checks, captures, errors, writes, legacyRequests, readinessReads, sourceFacts: assets.sourceFacts, finalSourceFacts, changedSources, bundleFacts: assets.bundleFacts, fixture: assets.fixture, limits: ["Synthetic session aggregates", "Start never clicked", "Owner physical-device acceptance pending"] }, null, 2));
  await browser.close();
  assert.deepEqual(changedSources, [], "browser evidence is source-bound");
}
process.stdout.write(`R127 retirement PASS: ${checks.length} viewport/theme checks; ${captures.length} captures\n`);
