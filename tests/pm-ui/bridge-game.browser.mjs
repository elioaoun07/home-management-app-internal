// Start fixtures/a5-browser.mjs --launchpad first. All scenarios are synthetic;
// no provider, account, native session or production data is accessed.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";

const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const evidence = ".pm/r102-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [], writes = [], screenshots = [], observations = [], layoutFailures = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
    writes.push(`${request.method()} ${request.url()}`);
});
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
let scenario = "active";
let sdkScenario = "installed";
let releaseUat;

function flight(id, quality, daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const record = {
    session: {
      schema: "os/session@1", id, agent: "claude", coverage: "transcript",
      tier: "CLAUDE_MID", effort: "medium", base: "a".repeat(40), head: "b".repeat(40),
      startedAt: new Date(date.getTime() - 60000).toISOString(), endedAt: date.toISOString(),
      setup: { fingerprint: "sha256:bridge-browser-fixture" },
      skills: [], reads: [], timeline: [], usage: {}, turns: null,
    },
    events: [],
    verdicts: Array.from({ length: 29 }, (_, index) => ({
      rule: `HR-${index + 1}`, verdict: "pass", level: "checked", added: 0, removed: 0,
    })),
    checks: ["typecheck", "lint", "test", "pm:lint", "docs:check", "os:check"].map((name) => ({
      id: name, name, source: "supervisor", exitCode: 0,
    })),
  };
  if (quality === "failed") record.checks[0].exitCode = 1;
  if (quality === "unknown") record.checks = [];
  record.session.scorecard = sessionScorecard(record, []);
  return record;
}
const flights = [flight("browser-clean", "clean", 0), flight("browser-failed", "failed", 1), flight("browser-unknown", "unknown", 2)];
const queue = { running: [], waiting: [], decisions: [], candidates: [], applying: null };
const catalogue = (available) => ({
  executors: ["claude", "codex"].map((id) => ({
    id, backend_id: id, label: id, available, permitted: false, qualified: false,
    summary: "Synthetic SDK presence only", supportedEfforts: [], refusals: [],
    qualification: { ref: null, refusals: [] }, models: [], suggestions: {},
  })), policy: null, refusals: [],
});
const json = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });

await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  const path = url.pathname;
  if (path === "/api/data") {
    const response = await route.fetch();
    const data = await response.json();
    assert.ok(data.cockpit, "isolated fixture cockpit contract");
    data.cockpit.records = scenario === "empty" ? [] : flights;
    data.cockpit.stale = scenario === "stale";
    data.cockpit.pending = scenario === "snapshot-pending";
    data.cockpit.conflicts = scenario === "empty" ? [] : [{ code: "missing-target", severity: "error", source: "fixture", message: "Synthetic setup conflict" }];
    const book = data.files.find((file) => file.relPath.endsWith("Master Book.md"));
    assert.ok(book, "fixture book contract");
    if (scenario !== "empty") {
      const receipts = [0, 1, 2, 8, 8, 15, 22, 22, 22, 36, 43].map((daysAgo, index) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return `- ✅ ${day} — **BUD-${index + 20}** Synthetic shipped outcome.`;
      }).join("\n");
      book.raw += `\n${receipts}\n`;
    }
    return route.fulfill({ response, json: data });
  }
  if (path === "/api/delivery/v2/session") return json(route, { paired: scenario !== "unpaired", actor: "fixture", csrf: "fixture" });
  if (path === "/api/delivery/sessions") return json(route, { sessions: [] });
  if (path === "/api/delivery/v2/executors") {
    if (sdkScenario === "error") return json(route, { error: "Fixture unavailable" }, 503);
    return json(route, catalogue(sdkScenario === "installed" ? true : sdkScenario === "missing" ? false : null));
  }
  if (path === "/api/delivery/v2/queue") {
    if (scenario === "read-failure") return json(route, { error: "Fixture queue unavailable" }, 503);
    return json(route, { queue });
  }
  if (path === "/api/delivery/v2/uat") {
    if (scenario === "uat-pending") await new Promise((resolve) => { releaseUat = resolve; });
    return json(route, { handovers: [] });
  }
  if (path === "/api/delivery/v2/runs") {
    const runs = scenario === "active" ? [
      { run_id: "bridge-needs", alias: "BUD-9", title: "Review the recorded result", lifecycle: "REVIEW", ownerActionKind: "local-review", ownerAction: "Review", active: false },
      { run_id: "bridge-running", alias: "BUD-10", title: "Improve the weekly planner", lifecycle: "ACTIVE", ownerActionKind: "none", ownerAction: "Implementing", active: true },
    ] : [];
    return json(route, { runs, requests: [] });
  }
  return route.continue();
});

const toggle = () => page.getByRole("switch", { name: "Game layer", exact: true });
const root = () => page.locator(".bridge");
const capture = async (name, { fullPage = false, motion = false } = {}) => {
  if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    layoutFailures.push({ name, overflow: await page.evaluate(() => ({
      viewport: innerWidth, width: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll(".bridge *")].map((element) => ({
        class: element.className.baseVal ?? element.className,
        right: element.getBoundingClientRect().right, left: element.getBoundingClientRect().left,
        transform: getComputedStyle(element).transform,
      })).filter((element) => element.right > innerWidth),
    })) });
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage, animations: motion ? "allow" : "disabled" });
  screenshots.push(name);
};
const open = async () => {
  await page.goto(`${base}#/bridge`);
  await root().waitFor();
  await page.getByRole("region", { name: "Next up", exact: true }).waitFor();
};
const queueLinks = async () => page.locator(".bridge-workspace > .cockpit-panel a").evaluateAll((links) => links.map((link) => [link.textContent.trim(), link.getAttribute("href")]));
const waitMode = async (mode) => page.waitForFunction((value) => document.querySelector(".bridge")?.dataset.mode === value, mode);
const setMode = async (mode) => {
  if (await root().getAttribute("data-mode") !== mode) await toggle().click();
  await waitMode(mode);
};

try {
  await open();
  await page.getByRole("link", { name: /BUD-9/ }).waitFor();
  await page.locator(".provider-status").waitFor();
  await page.getByRole("link", { name: "Setup, attention needed", exact: true }).first().waitFor();
  assert.ok((await page.locator(".setup-attention-dot").allTextContents()).every((text) => text === ""), "Setup attention has no counter");
  assert.equal(await root().getAttribute("data-mode"), "calm");
  assert.equal(await page.locator(".bridge-core").count(), 0);
  assert.equal(await page.getByText("Guarded rules", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Clean streak", { exact: true }).count(), 0);
  const links = await queueLinks();
  assert.ok(links.some(([, href]) => href.includes("bridge-needs")));
  assert.ok(links.some(([, href]) => href.includes("bridge-running")));
  assert.ok(links.some(([, href]) => href.startsWith("#/deliver/")));
  const target = await toggle().boundingBox();
  assert.ok(target.width >= 40 && target.height >= 40, "toggle touch target");
  await toggle().focus();
  await page.keyboard.press("Space");
  await waitMode("game");
  const enter = await page.locator(".game-activation").evaluate((element) => ({
    duration: getComputedStyle(element).animationDuration,
    pointerEvents: getComputedStyle(element).pointerEvents,
    iterations: getComputedStyle(element).animationIterationCount,
  }));
  assert.equal(enter.duration, "1.8s");
  assert.equal(enter.pointerEvents, "none");
  assert.equal(enter.iterations, "1");
  await capture("transition-enter-start", { motion: true });
  for (const delay of [250, 350]) {
    await page.waitForTimeout(delay);
    const scale = await page.locator(".bridge-workspace .queue-heading").evaluateAll((elements) => elements.map((element) => {
      let x = 1, y = 1;
      for (let node = element; node && !node.classList.contains("bridge"); node = node.parentElement) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        x *= Math.abs(matrix.a);
        y *= Math.abs(matrix.d);
      }
      return { label: element.textContent.trim(), x, y };
    }));
    observations.push({ phase: delay === 250 ? "enter-250ms" : "enter-600ms", scale });
    for (const text of scale) {
      assert.ok(text.x > 0.9 && text.x < 1.1 && text.y > 0.9 && text.y < 1.1, `transition text stays readable: ${JSON.stringify(text)}`);
    }
    await capture(delay === 250 ? "transition-enter-250" : "transition-enter", { motion: true });
  }
  await page.waitForTimeout(1300);
  assert.deepEqual(await queueLinks(), links, "modes preserve queue actions");
  await page.getByRole("region", { name: "Shipped outcomes", exact: true }).waitFor();
  await page.getByRole("region", { name: "Session quality", exact: true }).waitFor();
  const quality = page.getByRole("region", { name: "Session quality", exact: true });
  await quality.getByRole("img", { name: "1 clean, 1 failed, 1 unknown", exact: true }).waitFor();
  await quality.getByRole("button", { name: "Clean 1", exact: true }).click();
  await quality.getByRole("link", { name: "browser-clean", exact: true }).waitFor();
  await quality.getByRole("button", { name: "Clean 1", exact: true }).click();
  const week = page.getByRole("button", { name: /Week of .*: [1-9]\d* shipped/ }).last();
  await week.click();
  assert.equal(await week.getAttribute("aria-pressed"), "true");
  assert.ok(await page.locator(".bridge-outcome-ids a").count() > 0, "chart opens outcome evidence");
  await week.click();
  await page.reload();
  await waitMode("game");
  assert.equal(await toggle().getAttribute("aria-checked"), "true");

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      await setMode("game");
      await page.waitForTimeout(1900);
      await capture(`game-${width}-${theme}`);
      await capture(`game-${width}-${theme}-full`, { fullPage: true });
      if (width === 390) {
        const targets = await page.locator(".bridge-bar, .bridge-core-link").evaluateAll((elements) => elements.map((element) => ({
          label: element.getAttribute("aria-label") || element.textContent,
          width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
        })));
        observations.push({ theme, targets });
        for (const target of targets)
          if (target.width < 40 || target.height < 40) layoutFailures.push({ name: "mobile touch target", ...target });
      }
      await setMode("calm");
      await page.waitForTimeout(1100);
      await capture(`calm-${width}-${theme}`, { fullPage: true });
      assert.deepEqual(await queueLinks(), links, `queue actions at ${width}/${theme}`);
    }
  }

  await setMode("game");
  await page.waitForTimeout(1900);
  await toggle().click();
  await waitMode("calm");
  const exit = await page.locator(".game-activation").evaluate((element) => ({
    duration: getComputedStyle(element).animationDuration,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }));
  assert.equal(exit.duration, "1s");
  assert.equal(exit.pointerEvents, "none");
  await capture("transition-exit", { motion: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setMode("game");
  assert.equal(await page.locator(".game-activation").evaluate((element) => getComputedStyle(element).animationName), "none");
  const moving = await page.locator(".bridge").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);
  assert.equal(moving, 0, "reduced motion disables Bridge animation");

  scenario = "uat-pending";
  const reads = Promise.all(["/api/delivery/v2/runs", "/api/delivery/v2/queue"].map((path) => page.waitForResponse((response) => new URL(response.url()).pathname === path)));
  await page.reload();
  await reads;
  await page.locator(".bridge-core[data-state='unknown']").waitFor();
  await capture("uat-pending-390", { fullPage: true });
  assert.ok(releaseUat, "UAT read is pending");
  releaseUat();
  await page.locator(".bridge-core[data-state='idle']").waitFor();
  observations.push({ state: "uat-pending", confirmedOnlyAfterUatRead: true });

  for (const [state, sdk] of [["idle", "missing"], ["empty", "unknown"], ["read-failure", "error"], ["unpaired", "unknown"], ["stale", "installed"], ["snapshot-pending", "installed"]]) {
    scenario = state;
    sdkScenario = sdk;
    await page.reload();
    await waitMode("game");
    await page.locator(".provider-status").waitFor();
    if (state === "read-failure")
      await page.getByText("Delivery status unconfirmed", { exact: false }).waitFor();
    if (state === "unpaired")
      await page.getByRole("heading", { name: "Pair this browser", exact: true }).waitFor();
    if (state === "idle")
      await page.getByRole("region", { name: "Running", exact: true }).getByText("No active sessions", { exact: true }).waitFor();
    if (state === "stale")
      await page.getByText("Saved evidence", { exact: true }).waitFor();
    if (state === "snapshot-pending")
      await page.getByText("Session evidence unavailable", { exact: true }).waitFor();
    await page.waitForTimeout(1500);
    const status = await page.locator(".provider-status").innerText();
    observations.push({ state, sdk, status, core: await page.locator(".bridge-core").innerText() });
    if (sdk === "missing") assert.match(status, /missing|setup needed|not installed/i);
    if (sdk === "unknown" || sdk === "error") assert.match(status, /unknown|unavailable/i);
    await capture(`${state}-390`, { fullPage: true });
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(layoutFailures, []);
  writeFileSync(`${evidence}/result.json`, JSON.stringify({
    ok: true, synthetic: true, nativeSessions: 0, widths: [390, 768, 1440], themes: ["blue", "pink"],
    keyboard: true, queueActionParity: true, persisted: true, reducedMotion: true,
    enter, exit, observations, screenshots, errors, writes, layoutFailures,
  }, null, 2));
  process.stdout.write("Bridge browser PASS: calm/game, charts, both transition directions, keyboard/persistence, reduced motion, responsive themes, missing/unknown status, zero writes.\n");
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(`${evidence}/failure.txt`, `${error.stack}\n${JSON.stringify({ layoutFailures })}\n${await page.locator("body").innerText()}`);
  throw error;
} finally {
  await browser.close();
}
