// Start fixtures/a5-browser.mjs --launchpad first. Every launch request is
// intercepted here. The fixture has no provider credentials or production data.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { LAUNCH_GATES, READINESS_SCHEMA } from "../../scripts/delivery-v2/readiness-contract.mjs";

const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH ? { executablePath: process.env.ERA_CHROME_PATH } : {}),
});
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const origin = new URL(base).origin;
const evidence = ".pm/delivery-launch-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [], blockedWrites = [], launchRequests = [], readinessReads = [], screenshots = [];
page.on("pageerror", (error) => errors.push(error.message));
const json = (route, value, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(value),
});
const selection = {
  file: "Budget/4 - Checklist.md", id: "BUD-1", executor: "codex",
  model: "fixture-codex", effort: "medium", workProfile: "focused",
};
const catalogue = {
  executors: ["claude", "codex"].map((id) => ({
    id, backend_id: id, label: id === "claude" ? "Claude" : "Codex",
    available: true, permitted: id === "codex", qualified: id === "codex",
    summary: "Synthetic installed executor", supportedEfforts: ["medium"],
    refusals: [], qualification: { ref: id === "codex" ? "fixture" : null, refusals: [] },
    models: [{ id: `fixture-${id}`, label: `Fixture ${id}`, efforts: ["medium"] }],
    suggestions: Object.fromEntries(["focused", "investigate"].map((profile) => [profile, {
      model: `fixture-${id}`, effort: "medium", reason: null,
    }])),
  })),
  policy: { policy_revision: 1, runtime: { kind: "fixture", image: "fixture", network: "none" }, thresholdUsd: null },
  refusals: [],
};
function blockedReadiness(settings = selection, policyBlocked = false) {
  const code = policyBlocked ? "executor-not-permitted" : "fixture-environment-blocked";
  const gate = policyBlocked ? "policy" : "environment";
  const detail = policyBlocked ? "Claude is disabled in the Confined policy" : "Fixture environment needs repair";
  return {
    schema: READINESS_SCHEMA, phase: "launch", status: "blocked", ready: false,
    fingerprint: `sha256:${"a".repeat(64)}`, authority: "inspection-only",
    selection: settings, expiresAt: null,
    blockers: [{ gate, state: "blocked", code, detail }],
    facts: Object.fromEntries(LAUNCH_GATES.map((name) => [name, name === gate
      ? { state: "blocked", code, detail }
      : { state: "satisfied", code: "fixture-pass" }])),
    nextActions: [], authorization: { key: "fixture", expiresAt: null, renewedAt: null },
  };
}
let releaseLaunch;
let delayLaunch = false;
let localSuccess = false;
const localRunId = "local-00000000-0000-4000-8000-000000000001";
await page.route("**/*", async (route) => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin) return route.abort();
  const path = url.pathname;
  if (path === "/api/delivery/v2/session")
    return json(route, { paired: true, actor: "browser-fixture", csrf: "fixture", scope: "delivery-launch-fixture" });
  if (path === "/api/delivery/v2/mode") return json(route, { mode: "v2" });
  if (path === "/api/delivery/v2/executors") return json(route, catalogue);
  if (path === "/api/delivery/v2/runs") return json(route, { runs: [], requests: [] });
  if (path === "/api/delivery/sessions") return json(route, { sessions: [] });
  if (path === "/api/delivery/v2/queue")
    return json(route, { queue: { running: [], waiting: [], decisions: [], candidates: [], applying: null } });
  if (path === "/api/delivery/v2/uat") return json(route, { handovers: [] });
  if (path === "/api/delivery/v2/readiness") {
    readinessReads.push(path);
    return json(route, blockedReadiness(Object.fromEntries(url.searchParams)));
  }
  if (path === "/api/delivery/v2/local/readiness") {
    readinessReads.push(path);
    return json(route, { ready: false, facts: {
      source: { state: "fail", code: "commit-or-stash-changes", detail: "a".repeat(40) },
      authentication: { state: "pass", code: "fixture-subscription" },
      environment: { state: "pass", code: "fixture-environment" },
    } });
  }
  if (path === "/api/delivery/v2/command")
    return json(route, { error: "unknown-command" }, 404);
  if (path === "/api/delivery/v2/local/run") return json(route, {
    run_id: localRunId, phase: "building", workspace: "fixture-worktree", branch: "fixture-branch",
    head: null, current_head: null, canShip: false, canUndo: false, interrupted: false,
    work: { id: "BUD-1", title: "Verify cockpit fixture" }, checks: [], activity: [], usage: null, handover: null,
  });
  if (request.method() === "POST" && ["/api/delivery/v2/local", "/api/delivery/v2/deliver"].includes(path)) {
    const body = request.postDataJSON();
    launchRequests.push({ path, body });
    if (delayLaunch) await new Promise((resolve) => { releaseLaunch = resolve; });
    if (path.endsWith("/local") && localSuccess) return json(route, { ok: true, run_id: localRunId });
    if (path.endsWith("/local")) return json(route, {
      ok: false, error: "local-readiness-failed", detail: "Commit or stash pending changes",
      readiness: { ready: false, facts: {
        source: { state: "fail", code: "commit-or-stash-changes", detail: "a".repeat(40) },
        authentication: { state: "pass", code: "fixture-subscription" },
        environment: { state: "pass", code: "fixture-environment" },
      } },
    }, 409);
    const policyBlocked = body.executor === "claude";
    return json(route, {
      ok: false,
      refusals: [{ code: policyBlocked ? "executor-not-permitted" : "readiness-blocked", detail: policyBlocked ? "Claude is disabled in the Confined policy" : "Fixture environment needs repair" }],
      readiness: blockedReadiness({ ...selection, executor: body.executor, model: body.model, effort: body.effort, workProfile: body.workProfile }, policyBlocked),
    }, 409);
  }
  if (!["GET", "HEAD"].includes(request.method())) {
    blockedWrites.push(`${request.method()} ${path}`);
    return route.abort();
  }
  if (path.startsWith("/api/delivery/v2/")) return json(route, { error: "unmocked-fixture-read" }, 404);
  return route.continue();
});

const start = () => page.getByRole("button", { name: "Start", exact: true });
const toggle = () => page.getByRole("switch", { name: "Game layer", exact: true });
const open = async (lane = "local") => {
  await page.goto(`${base}#/deliver/Budget/BUD-1?from=%2Fbridge${lane === "confined" ? "&lane=confined" : ""}`);
  await page.getByRole("heading", { name: "Verify cockpit fixture", exact: true }).waitFor();
  await start().waitFor();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((entry) => entry.textContent.trim() === "Start");
    return button && !button.disabled;
  });
};
const initial = async () => {
  assert.equal(await start().isDisabled(), false);
  assert.equal(await page.getByRole("button", { name: "Check readiness", exact: true }).count(), 0);
  assert.equal(await page.getByRole("region", { name: "Local readiness", exact: true }).count(), 0);
  assert.equal(await page.getByRole("region", { name: "Readiness", exact: true }).count(), 0);
  assert.equal(await page.getByRole("region", { name: "Start result", exact: true }).count(), 0);
};
const capture = async (name) => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true, animations: "disabled" });
  screenshots.push(name);
};
const setGame = async (enabled) => {
  const target = page.url();
  await page.goto(`${base}#/bridge`);
  await toggle().waitFor();
  if ((await toggle().getAttribute("aria-checked")) !== String(enabled)) await toggle().click();
  await page.goto(target);
  await start().waitFor();
  if (enabled) await page.locator(".delivery-mission").waitFor();
  else await page.locator(".delivery-mission").waitFor({ state: "detached" });
};
const doubleStart = async () => {
  const count = launchRequests.length;
  delayLaunch = true;
  releaseLaunch = undefined;
  // Two clicks in one event turn exercise the handler's pending guard.
  await start().evaluate((button) => { button.click(); button.click(); });
  await page.getByRole("button", { name: /Checking…|Starting…/ }).waitFor();
  await page.waitForFunction(() => document.querySelector("button.primary:disabled") !== null);
  for (let attempt = 0; attempt < 40 && !releaseLaunch; attempt++) await page.waitForTimeout(25);
  assert.ok(releaseLaunch, "mock Start reached");
  assert.equal(launchRequests.length, count + 1, "one request for a double click");
  releaseLaunch();
  delayLaunch = false;
  await start().waitFor();
  assert.equal(await start().isDisabled(), false, "blocked Start can be retried");
};

try {
  await open();
  await initial();
  await page.getByLabel("Model", { exact: true }).selectOption("fixture-claude");
  await page.getByLabel("Effort", { exact: true }).selectOption("medium");
  await doubleStart();
  await page.getByText("Commit or stash pending changes", { exact: false }).first().waitFor();
  assert.equal(launchRequests[0].body.executor, "claude");
  assert.equal(launchRequests[0].body.model, "fixture-claude");
  assert.equal(launchRequests[0].body.effort, "medium");
  await capture("local-blocked-desktop");
  await page.getByLabel(/Executor/).selectOption("codex");
  assert.equal(await page.getByLabel("Model", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Effort", { exact: true }).inputValue(), "");
  assert.equal(await page.getByText("Commit or stash pending changes", { exact: false }).count(), 0, "changing Local executor clears prior failure");
  await initial();

  await open("confined");
  await initial();
  await doubleStart();
  assert.equal(launchRequests.at(-1).body.executor, "codex", "permitted installed executor is preselected");
  await page.getByRole("region", { name: "Start result", exact: true }).waitFor();
  await page.getByText("Fixture environment needs repair", { exact: true }).first().waitFor();
  await capture("confined-blocked-desktop");
  await page.locator(".launch-settings > summary").click();
  const claude = page.locator(".provider-choices button").filter({ hasText: "Claude" });
  assert.equal(await claude.getAttribute("aria-disabled"), null, "installed Claude remains selectable");
  await claude.click();
  assert.equal(await page.getByRole("region", { name: "Start result", exact: true }).count(), 0, "changing confined executor clears prior failure");
  await start().click();
  await page.getByText("Claude is disabled in the Confined policy", { exact: true }).first().waitFor();
  const localLink = page.getByRole("link", { name: "Use Local", exact: true });
  await localLink.waitFor();
  assert.equal(new URL(await localLink.getAttribute("href"), base).hash.includes("lane=confined"), false);
  await capture("claude-confined-policy");

  // Fresh browsing session clears the synthetic refusal receipts for visual QA.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("pm-command-intent:") || key.startsWith("pm-command-receipt:")) localStorage.removeItem(key);
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      for (const lane of ["local", "confined"]) {
        await open(lane);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page.getByRole("button", { name: `Use ${theme} theme` }).click();
        await setGame(false);
        await initial();
        await capture(`${lane}-calm-${width}-${theme}`);
        await setGame(true);
        await initial();
        await page.waitForTimeout(1900);
        await capture(`${lane}-game-${width}-${theme}`);
        const bounds = await start().boundingBox();
        assert.ok(bounds.width >= 40 && bounds.height >= 40, "Start touch target");
      }
    }
  }
  await page.reload();
  await page.locator(".delivery-mission").waitFor();
  assert.equal(await page.locator(".game-shell").getAttribute("data-game"), "true", "Game mode persists");
  await page.locator('.delivery-mission[data-motion="active"]').waitFor();
  assert.ok(await page.locator(".mission-scene").evaluate((element) => element.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")), "Game scene animates while visible");
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "browser-offscreen-spacer";
    spacer.style.height = "200vh";
    document.body.append(spacer);
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.locator('.delivery-mission[data-motion="paused"]').waitFor();
  assert.equal(await page.locator(".mission-scene").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0, "offscreen mission animation pauses");
  await page.evaluate(() => { document.getElementById("browser-offscreen-spacer").remove(); window.scrollTo(0, 0); });
  await page.locator('.delivery-mission[data-motion="active"]').waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('.delivery-mission[data-motion="paused"]').waitFor();
  await page.waitForFunction(() => document.querySelector(".delivery-mission").getAnimations({ subtree: true }).every((animation) => animation.playState !== "running"));
  assert.equal(await page.locator(".delivery-mission").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0, "reduced motion pauses mission animation");
  await capture("confined-game-reduced-motion-390-pink");

  localSuccess = true;
  await open();
  await start().click();
  await page.waitForURL(`**/#/delivery/run/${localRunId}`);
  await page.getByText("building", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Ship", exact: true }).isDisabled(), true);
  await capture("local-successful-start-390-pink");
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedWrites, []);
  assert.equal(launchRequests.length, 4, "only explicit synthetic Start attempts");
  assert.deepEqual(readinessReads, [], "navigation never starts readiness checks");
  assert.ok(launchRequests.every(({ path }) => path.endsWith("/local") || path.endsWith("/deliver")));
  writeFileSync(`${evidence}/result.json`, JSON.stringify({
    ok: true, synthetic: true, nativeSessions: 0, widths: [1440, 390], themes: ["blue", "pink"],
    deferredReadiness: true, singleRequestOnDoubleClick: true, selectionClearsFailure: true,
    claudePolicyReason: true, localRecoveryLink: true, reducedMotion: true, offscreenPause: true, successfulLocalNavigation: true,
    launchRequests, readinessReads, screenshots, errors, blockedWrites,
  }, null, 2));
  process.stdout.write("Deliver launch browser PASS: Start checks, retry, policy explanation, calm/game, mobile themes, reduced motion, synthetic requests only.\n");
} catch (error) {
  writeFileSync(`${evidence}/failure.txt`, `${error.stack}\n${JSON.stringify({ launchRequests, readinessReads, errors, blockedWrites })}\n${await page.locator("body").innerText()}`);
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
