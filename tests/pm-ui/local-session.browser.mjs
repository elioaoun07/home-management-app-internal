// Credential-free A5 fixture only. All session responses are synthetic; every
// write and non-fixture request is blocked. Never starts a native provider.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
});
await context.addInitScript(() => localStorage.setItem("pm-game-layer", "on"));
const page = await context.newPage();
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const origin = new URL(base).origin;
const evidence = ".pm/r117-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [],
  writes = [],
  observations = [];
page.on("pageerror", (error) => errors.push(error.message));
let scene = "failed",
  sequence = 0;
const id = "local-00000000-0000-4000-8000-000000000117";
const at = "2026-11-14T18:23:36Z";
const local = () => ({
  run_id: id,
  phase: scene === "interrupted" ? "building" : scene,
  branch: "delivery/BUD-1",
  workspace: "C:/fixture/very-long-worktree-path/retained-failed-attempt/BUD-1",
  head: ["checking", "uat-ready"].includes(scene) ? "c".repeat(40) : null,
  current_head: "b".repeat(40),
  work: {
    id: "BUD-1",
    campaign: "Budget",
    title: "BUD-1 Verify cockpit fixture — criteria",
    brief:
      "**Outcome:** Verify cockpit fixture.\n\n- **Acceptance:** Only the owning host can read guest records.\n- Anonymous bulk read returns 401.\n- Host from another tag receives 403.\n- Owning host receives 200.",
  },
  settings: { executor: "claude", model: "fixture-claude", effort: "medium" },
  canShip: false,
  canUndo: false,
  interrupted: scene === "interrupted",
  error:
    scene === "failed"
      ? "native session exited 1: TypeError: Cannot freeze\n    at deepFreeze (file:///C:/fixture/scripts/delivery-v2/contracts.mjs:172:12)"
      : undefined,
  activity: [{ at, summary: "Native session started" }],
  usage: null,
  checks:
    scene === "checking"
      ? [
          {
            name: "typecheck",
            exit: 0,
            stdout: "Typecheck passed",
            stderr: "",
            error: null,
          },
          {
            name: "lint",
            exit: null,
            stdout: "",
            stderr: "",
            error: "Checker interrupted",
          },
        ]
      : [],
  handover:
    scene === "uat-ready"
      ? { handover_id: "fixture-uat", acceptance: { state: "not-accepted" } }
      : null,
});
const waiting = {
  run_id: "local-older-uat",
  engine: "v2",
  lane: "local",
  alias: "BUD-2",
  title: "Older owner UAT",
  lifecycle: "ACTIVE",
  closed_outcome: null,
  stage: "uat-ready",
  active: false,
  ownerAction: "Ready to test",
  ownerActionKind: "local-review",
  updated_at: "2026-11-14T17:00:00Z",
  created_at: "2026-11-14T16:00:00Z",
  branch: null,
};
const main = () => ({
  run_id: id,
  engine: "v2",
  lane: "local",
  alias: "BUD-1",
  title: "Verify cockpit fixture",
  lifecycle: scene === "failed" ? "CLOSED" : "ACTIVE",
  closed_outcome: scene === "failed" ? "failed" : null,
  stage: scene === "interrupted" ? "building" : scene,
  active: ["preparing", "building", "checking"].includes(scene),
  ownerAction: scene,
  ownerActionKind: scene === "interrupted" ? "inspect-session" : "none",
  updated_at: at,
  created_at: at,
  branch: "delivery/BUD-1",
  application: null,
});
const json = (route, data) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(data),
  });
await page.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.origin !== origin) return route.abort();
  if (!["GET", "HEAD"].includes(request.method())) {
    writes.push(url.pathname);
    return route.abort();
  }
  if (url.pathname === "/api/delivery/v2/session")
    return json(route, { paired: true, actor: "fixture", csrf: "fixture" });
  if (url.pathname === "/api/delivery/sessions")
    return json(route, { sessions: [] });
  if (url.pathname === "/api/delivery/v2/local/run")
    return json(route, local());
  if (url.pathname === "/api/delivery/v2/runs")
    return json(route, {
      runs: [
        waiting,
        ...(["attention", "blocked"].includes(scene) ? [] : [main()]),
      ],
      requests:
        scene === "blocked"
          ? [
              {
                command_id: "blocked-fixture",
                status: "blocked",
                run_id: null,
                terminal: false,
                acceptedAt: at,
                lastConfirmedAt: at,
                staleAfterMs: 180000,
                workId: "BUD-1",
                blocker: { code: "fixture-blocked" },
              },
            ]
          : [],
    });
  if (url.pathname === "/api/delivery/v2/queue")
    return json(route, {
      queue: {
        running: [],
        waiting: [],
        decisions: [],
        candidates: [],
        applying: null,
        unknown: { jobs: [] },
      },
    });
  if (url.pathname === "/api/delivery/v2/uat")
    return json(route, { handovers: [] });
  return route.continue();
});
async function open(path, next, theme) {
  scene = next;
  await page.goto(`${base}?local-scene=${++sequence}#${path}`);
  const toggle = page.getByRole("button", { name: /Use (pink|blue) theme/ });
  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-label")) === `Use ${theme} theme`)
    await toggle.click();
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    theme,
  );
}
async function capture(name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name}: no horizontal overflow`,
  );
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
  observations.push(name);
}
const core = () => page.locator(".bridge-core");
const waitState = (state) =>
  page.waitForFunction(
    (expected) =>
      document.querySelector(".bridge-core")?.dataset.state === expected,
    state,
  );
try {
  for (const width of [1440, 390])
    for (const theme of ["blue", "pink"]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
      const key = `${width}-${theme}`;
      await open(`/delivery/run/${id}`, "failed", theme);
      await page
        .getByRole("alert")
        .filter({ hasText: "Agent could not start" })
        .waitFor();
      for (const name of ["Plan", "Verification", "Activity", "Changes"])
        assert.equal(
          await page.getByRole("region", { name, exact: true }).count(),
          1,
        );
      assert.equal(await page.getByText("Not run", { exact: true }).count(), 4);
      await page.getByText("Error details", { exact: true }).click();
      await capture(`${key}-failed-session`);
      const retry = page.getByRole("link", {
        name: "New attempt",
        exact: true,
      });
      assert.ok(
        (await retry.getAttribute("href")).includes("/deliver/Budget/BUD-1"),
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Ship", exact: true })
          .isDisabled(),
        true,
      );
      await retry.click();
      await page.getByRole("button", { name: "Start", exact: true }).waitFor();
      await open(`/delivery/run/${id}`, "building", theme);
      await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
      await capture(`${key}-running-session`);
      await open(`/delivery/run/${id}`, "checking", theme);
      await page.getByText("Inconclusive", { exact: true }).waitFor();
      assert.equal(await page.getByText("Passed", { exact: true }).count(), 1);
      await open(`/delivery/run/${id}`, "uat-ready", theme);
      await page
        .getByRole("link", { name: "Test steps", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Ship", exact: true })
          .isDisabled(),
        true,
      );
      await capture(`${key}-uat-session`);
      await open("/bridge", "building", theme);
      await waitState("running");
      await page.waitForFunction(
        () => Number(document.querySelector(".bridge-core")?.dataset.rpm) > 100,
      );
      const angle = Number(await core().getAttribute("data-angle"));
      await page.waitForTimeout(300);
      assert.ok(
        Number(await core().getAttribute("data-angle")) > angle + 30,
        "sustained rotation with unrelated UAT",
      );
      await capture(`${key}-running-core`);
      // Poll the same mounted core: state/color/geometry must update without reload.
      scene = "failed";
      await waitState("failed");
      assert.equal(
        await page
          .locator(".core-split-ring")
          .evaluate((el) => getComputedStyle(el).display),
        "block",
      );
      assert.equal(
        await core().evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--core-sat").trim(),
        ),
        "0%",
      );
      await capture(`${key}-failed-core`);
      await open("/bridge", "blocked", theme);
      await waitState("failed");
      await page.getByText("Launch blocked", { exact: true }).waitFor();
      await capture(`${key}-blocked-core`);
      await open("/bridge", "interrupted", theme);
      await waitState("failed");
      await open("/bridge", "attention", theme);
      await waitState("attention");
      await capture(`${key}-waiting-core`);
    }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open("/bridge", "building", "blue");
  await waitState("running");
  await page.waitForTimeout(200);
  assert.equal(
    Number(await core().getAttribute("data-rpm")),
    0,
    "reduced motion stays static",
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      { observations, errors, writes, reducedMotion: true },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Local session browser checks passed: ${observations.length} screenshots, no writes or runtime errors\n`,
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.json`,
    JSON.stringify(
      {
        url: page.url(),
        errors,
        writes,
        text: await page.locator("body").innerText(),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
