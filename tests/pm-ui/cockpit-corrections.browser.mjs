// R128: browser-fulfilled facts over the isolated A5 server. No live services.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";
import {
  chromiumExecutable,
  fixtureAssets,
  sourceSnapshot,
} from "./fixtures/local-stage-board.mjs";

const evidence = process.env.ERA_COCKPIT_CORRECTIONS_EVIDENCE || ".pm/r128-evidence";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const base = assets.base;
const origin = new URL(base).origin;
const fixtureResponse = await fetch(new URL("/api/data", base));
assert.equal(fixtureResponse.status, 200, "isolated fixture data is available");
const baseline = await fixtureResponse.json();
assert.ok(Array.isArray(baseline.files) && baseline.cockpit?.setup);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const executablePath = chromiumExecutable();
assert.ok(executablePath, "installed Chromium is required");
const browser = await chromium.launch({ headless: true, executablePath });
const errors = [], writes = [], simulated = [], captures = [], checks = [];
const profiles = [
  { width: 1280, height: 640, dpr: 1 },
  { width: 1358, height: 696, dpr: 1.65 },
  { width: 1494, height: 934, dpr: 1.5 },
  { width: 390, height: 844, dpr: 1 },
];
const at = "2026-11-15T10:00:00Z";
const since = "2026-11-15T06:39:25.775Z";
const deliveryPaths = [
  "/api/delivery/v2/runs",
  "/api/delivery/v2/queue",
  "/api/delivery/v2/uat",
];
const makeRun = (run_id, extra = {}) => ({
  run_id, engine: "v2", alias: "BUD-1", campaign: "Budget",
  file: "Budget/4 - Checklist.md", title: "Recorded fixture",
  lifecycle: "ACTIVE", closed_outcome: null, waiting_reason: null,
  executor: "codex", model: "fixture", effort: "medium", stage: "Build",
  branch: null, active: false, ownerAction: "Working", ownerActionKind: "none",
  created_at: at, updated_at: at, ...extra,
});
const runs = [
  makeRun("fixture-question", { ownerAction: "Answer question", ownerActionKind: "question" }),
  makeRun("fixture-running", { active: true }),
  makeRun("local-cac958d7-1f8e-4e65-9cb8-1471c839f796", {
    lane: "local", alias: "HUB-118", title: "Retained failure fixture",
    lifecycle: "CLOSED", closed_outcome: "failed", ownerAction: "Failed",
  }),
];
function makeData(state) {
  const data = structuredClone(baseline);
  data.generatedAt = at;
  data.files = data.files.filter((file) => file.relPath !== "_Decisions.md");
  data.files.push({
    relPath: "_Decisions.md",
    raw: "# Decisions\n\n## Open choices\n\n| ID | Choice | Constraint | Source |\n|---|---|---|---|\n" +
      Array.from({ length: 21 }, (_, i) => `| DEC-${i + 1} | Recorded choice ${i + 1} | Owner | Fixture |`).join("\n"),
  });
  const record = {
    session: {
      id: "fixture-missing-checks", agent: "claude", itemId: "BUD-1",
      runId: "fixture-question", startedAt: at, endedAt: at,
      base: "a".repeat(40), head: "b".repeat(40), coverage: "transcript",
      skills: [{ name: "start-task", at }], reads: [], timeline: [],
      usage: {}, turns: 1, changeFacts: [], outcome: "unrecorded",
    },
    events: [], checks: [], verdicts: [],
  };
  record.session.scorecard = sessionScorecard(record, []);
  data.cockpit = {
    ...data.cockpit,
    pending: false, stale: false, records: [record], groups: [], deliveries: [],
    warnings: [], recorder: state.unavailable
      ? { state: "unavailable", since }
      : { state: "recording", since: null },
    skillUsage: {
      available: !state.unavailable, recordedSessions: 1,
      skills: [{ name: "start-task", lastUsed: at, sessions: 1 }],
    },
    conflicts: [
      { code: "FIXTURE-E", severity: "error", source: "fixture", message: "Recorded error" },
      { code: "FIXTURE-W", severity: "warning", source: "fixture", message: "Recorded warning" },
      ...Array.from({ length: 12 }, (_, i) => ({
        code: `FIXTURE-N${i}`, severity: "info", source: "fixture", message: `Recorded note ${i + 1}`,
      })),
    ],
  };
  if (state.rescanned) {
    data.cockpit.setup.fingerprint = "sha256:fixture-rescanned";
    data.cockpit.setup.generatedAt = "2026-11-15T10:01:00Z";
  }
  return data;
}
function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}
async function install(context, theme) {
  const state = {
    unavailable: false, failed: false, rescanned: false,
    gates: new Map(deliveryPaths.map((path) => [path, deferred()])),
    received: new Set(),
  };
  await context.addInitScript(({ theme }) => {
    localStorage.setItem("pm-app-theme", theme);
    localStorage.setItem("pm-game-layer", "off");
  }, { theme });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const json = (body, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });
    if (!["GET", "HEAD"].includes(request.method())) {
      if (url.pathname === "/api/delivery/v2/cockpit/rescan" && request.method() === "POST") {
        assert.deepEqual(request.postDataJSON(), {});
        state.rescanned = true;
        simulated.push({ path: url.pathname, method: "POST", effect: "browser fulfilled; no server request" });
        return json({ cockpit: makeData(state).cockpit });
      }
      writes.push({ path: url.pathname, method: request.method() });
      return route.abort();
    }
    if (url.pathname === "/app/assets/pm.js")
      return route.fulfill({ contentType: "text/javascript", body: assets.bundle.js });
    if (url.pathname === "/app/assets/pm.css")
      return route.fulfill({ contentType: "text/css", body: assets.bundle.css });
    if (url.pathname === "/api/data") return json(makeData(state));
    if (url.pathname === "/api/delivery/sessions") return json({ sessions: [] });
    if (url.pathname === "/api/delivery/v2/session")
      return json({ paired: true, actor: "synthetic-fixture", csrf: "synthetic-no-writes" });
    const gate = state.gates.get(url.pathname);
    if (gate) {
      state.received.add(url.pathname);
      await gate.promise;
      if (state.failed) return json({ error: "Fixture delivery unavailable" }, 503);
      if (url.pathname.endsWith("/runs")) return json({ runs, requests: [] });
      if (url.pathname.endsWith("/uat")) return json({ handovers: [] });
      return json({ queue: {
        running: [], waiting: [], decisions: [], candidates: [], applying: null,
        pairs: [], unknown: { jobs: [], reservationsWithoutAmount: 0 }, nativeAgents: 1,
      } });
    }
    return route.continue();
  });
  return state;
}
async function capture(page, name) {
  const dimensions = await page.evaluate(() => ({
    innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.innerWidth, `${name}: horizontal overflow`);
  const path = `${evidence}/${name}.png`;
  await page.screenshot({ path, animations: "disabled", fullPage: true });
  captures.push({ name, path, ...dimensions });
}
async function open(page, path) {
  await page.goto(`${base}?cockpit-corrections=${Date.now()}#/${path}`);
  await page.locator(".page-title").first().waitFor();
}
async function holdObserved(page, state) {
  for (let i = 0; i < 100 && state.received.size < deliveryPaths.length; i++)
    await page.waitForTimeout(50);
  assert.equal(state.received.size, deliveryPaths.length, "all three delivery queries were held");
}
async function skeletons(page) {
  assert.equal(await page.locator(".bridge-needs .cockpit-skeleton").count(), 1);
  assert.equal(await page.locator(".bridge-running .cockpit-skeleton").count(), 1);
  assert.doesNotMatch(await page.locator(".bridge-needs h2").innerText(), /Needs you\s*·\s*21/u);
}
let activePage;
try {
  for (const profile of profiles) for (const theme of ["blue", "pink"]) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr, serviceWorkers: "block", reducedMotion: "reduce",
    });
    const state = await install(context, theme);
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => errors.push(error.message));
    const prefix = `${profile.width}-${theme}`;
    await open(page, "bridge");
    await holdObserved(page, state);
    await skeletons(page);
    await capture(page, `bridge-pending-${prefix}`);
    state.gates.get(deliveryPaths[0]).resolve();
    await page.waitForTimeout(150);
    await skeletons(page);
    state.gates.get(deliveryPaths[1]).resolve();
    await page.waitForTimeout(150);
    await skeletons(page);
    state.gates.get(deliveryPaths[2]).resolve();
    await page.locator(".bridge-needs .cockpit-skeleton").waitFor({ state: "detached" });
    assert.match(await page.locator(".bridge-needs h2").innerText(), /Needs you\s*·\s*22/u);
    assert.match(await page.locator(".bridge-needs").innerText(), /1 sessions?\s*·\s*21 decisions/u);
    assert.match(await page.locator(".bridge-running h2").innerText(), /Running\s*·\s*1/u);
    await capture(page, `bridge-settled-${prefix}`);
    await open(page, "sessions");
    for (const [lane, count] of [["needs", 1], ["running", 1]])
      await page.waitForFunction(({ lane, count }) =>
        document.querySelector(`.session-state-rail button[data-state="${lane}"] strong`)?.textContent.trim() === String(count),
      { lane, count });
    await capture(page, `sessions-counts-${prefix}`);
    await open(page, "setup");
    await page.getByText("Recording", { exact: true }).waitFor();
    const conflicts = page.getByRole("link", { name: /^Conflicts\s*·\s*2$/u });
    await conflicts.waitFor();
    await page.getByRole("button", { name: "Rescan", exact: true }).click();
    await page.getByRole("button", { name: "Rescan", exact: true }).waitFor({ state: "visible" });
    assert.equal(state.rescanned, true, "Rescan was browser fulfilled");
    await capture(page, `setup-recording-${prefix}`);
    await open(page, "score");
    const tile = page.locator(".game-facts details").filter({ has: page.getByText("Setup conflicts", { exact: true }) });
    assert.equal((await tile.locator("summary strong").innerText()).trim(), "2");
    await capture(page, `score-conflicts-${prefix}`);
    await open(page, "sessions/fixture-missing-checks");
    await page.getByText("No supervisor check results", { exact: true }).waitFor();
    assert.equal(await page.getByText("No base commit", { exact: true }).count(), 0);
    assert.equal(await page.getByText("No head commit", { exact: true }).count(), 0);
    await capture(page, `session-missing-fact-${prefix}`);
    state.unavailable = true;
    await open(page, "setup");
    await page.getByText(/Unavailable since/u).waitFor();
    await capture(page, `setup-unavailable-${prefix}`);
    state.failed = true;
    await open(page, "bridge");
    await page.locator(".bridge-needs .cockpit-skeleton").waitFor({ state: "detached" });
    await page.locator(".bridge-needs").getByText("Unconfirmed", { exact: true }).waitFor();
    await page.locator(".bridge-running").getByText("Unconfirmed", { exact: true }).waitFor();
    assert.match(await page.locator(".bridge-needs h2").innerText(), /Needs you\s*·\s*21/u);
    await capture(page, `bridge-unconfirmed-${prefix}`);
    checks.push({ viewport: profile, theme, needs: 1, decisions: 21, total: 22, running: 1, conflicts: 2 });
    await context.close();
    activePage = null;
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${evidence}/cockpit-failure.png`, fullPage: true });
    writeFileSync(`${evidence}/cockpit-failure.txt`, `${error.stack}\n${await activePage.locator("body").innerText()}`);
  }
  throw error;
} finally {
  const finalSourceFacts = sourceSnapshot();
  const changedSources = [...new Set([...Object.keys(assets.sourceFacts), ...Object.keys(finalSourceFacts)])]
    .filter((path) => assets.sourceFacts[path]?.sha256 !== finalSourceFacts[path]?.sha256);
  writeFileSync(`${evidence}/cockpit-result.json`, JSON.stringify({
    ok: checks.length === profiles.length * 2 && !errors.length && !writes.length && !changedSources.length,
    checks, captures, errors, writes, simulated, sourceFacts: assets.sourceFacts,
    finalSourceFacts, changedSources, bundleFacts: assets.bundleFacts,
    fixture: assets.fixture, browser: browser.version(),
    limits: ["Synthetic recorder/delivery facts", "No provider or real session", "Owner/device UAT pending"],
  }, null, 2));
  await browser.close();
  assert.deepEqual(changedSources, [], "browser evidence is source-bound");
}
process.stdout.write(`R128 cockpit PASS: ${checks.length} viewport/theme checks; ${captures.length} captures\n`);
