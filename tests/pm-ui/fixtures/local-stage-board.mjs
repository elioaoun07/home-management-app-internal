import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { buildApp } from "../../../scripts/pm/app-build.mjs";

const iso = (time) => new Date(time).toISOString();
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export function sourceSnapshot() {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : [join(dir, entry.name)],
    );
  return Object.fromEntries(
    walk("scripts/pm/app")
      .filter((path) => /\.(?:ts|tsx|css)$/u.test(path))
      .map((path) => [
        relative(".", path).replaceAll("\\", "/"),
        { sha256: sha256(readFileSync(path)), bytes: statSync(path).size },
      ]),
  );
}
export const profiles = [
  { width: 1280, height: 640, dpr: 1 },
  { width: 1358, height: 696, dpr: 1.65 },
  { width: 1494, height: 934, dpr: 1.5 },
  { width: 2560, height: 1271, dpr: 1 },
  { width: 2560, height: 1440, dpr: 2 },
  { width: 390, height: 844, dpr: 1 },
];
// Keep earlier evidence names stable while giving the literal upper endpoint
// a distinct path from the existing 2560 x 1271 regression profile.
export const profileKey = (profile) =>
  profile.width === 2560 && profile.height === 1440
    ? "2560x1440-dpr2"
    : String(profile.width);
export function stageProfiles() {
  const widths = process.env.ERA_STAGE_WIDTHS?.split(",").map(Number);
  return profiles.filter((profile) => !widths || widths.includes(profile.width));
}
export const stageThemes = () => process.env.ERA_STAGE_THEMES?.split(",") || ["blue", "pink"];
export const matrix = JSON.parse(
  readFileSync(".pm/r123-evidence/attention-fixture-matrix.json", "utf8"),
);
const cases = new Map(matrix.localCases.map((value) => [value.name, value]));
export function shiftCase(name, now = Date.now()) {
  const source = cases.get(name);
  assert.ok(source, name);
  const delta = now - source.now;
  const shift = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
    Number.isFinite(Date.parse(value))
      ? iso(Date.parse(value) + delta)
      : Array.isArray(value)
        ? value.map(shift)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, child]) => [key, shift(child)]),
            )
          : value;
  const run = shift(source.run);
  run.work = { campaign: "PM Tooling", ...run.work };
  run.settings ??= {
    executor: "codex",
    model: "fixture-codex",
    effort: "high",
  };
  return run;
}
/** Every row is an explicit synthetic recorded fact, never a live command. */
export function specimen(now = Date.now()) {
  const run = shiftCase("failed-hook", now);
  const start = now - 200_000;
  const rows = [];
  const add = (second, kind, summary, job_id = "native") =>
    rows.push({
      at: iso(start + second * 1000),
      kind,
      summary,
      job_id,
      seq: rows.length,
    });
  add(0, "status", "Installing dependencies", "supervisor");
  add(0, "status", "Native session started");
  add(4, "command", "Get-Content src/app/api/fixture.ts");
  add(8, "command", "rg fixture src");
  add(12, "message", "Recorded board implementation plan");
  for (let i = 0; i < 12; i++)
    add(16 + i * 2, "edit", `src/fixture/part-${i}.ts`);
  add(43, "command", "pnpm typecheck");
  add(47, "message", "Recorded implementation summary");
  add(51, "status", "Committing candidate", "supervisor");
  add(170, "status", "Host checks started", "supervisor");
  for (const [i, check] of ["typecheck", "lint", "test", "pm:lint"].entries()) {
    add(172 + i * 4, "status", `${check} started`, "supervisor");
    add(174 + i * 4, "status", `${check}: 0`, "supervisor");
  }
  add(190, "status", "Freezing handover", "supervisor");
  add(194, "status", "Ready for owner UAT", "supervisor");
  run.activity = rows;
  run.phase = "uat-ready";
  run.error = undefined;
  run.interrupted = false;
  run.head = "c".repeat(40);
  run.reviewed_head = null;
  run.checks = ["typecheck", "lint", "test", "pm:lint"].map((name, i) => ({
    name,
    exit: 0,
    stdout: "Fixture passed",
    stderr: "",
    error: null,
    started_at: iso(start + (172 + i * 4) * 1000),
    finished_at: iso(start + (174 + i * 4) * 1000),
  }));
  run.handover = shiftCase("uat-test", now).handover;
  run.usage = { input: 1200, output: 300 };
  return run;
}

export async function fixtureAssets(evidence) {
  const fixture = JSON.parse(
    readFileSync(".pm/a5-evidence/fixture.json", "utf8"),
  );
  assert.match(basename(fixture.root), /^era-a5-browser-/u);
  assert.notEqual(resolve(fixture.root), resolve("."));
  const base = process.env.ERA_COCKPIT_URL || fixture.url + "/";
  assert.equal(new URL(base).origin, new URL(fixture.url).origin);
  const bundle = await buildApp();
  const bundleFacts = Object.fromEntries(
    Object.entries(bundle).map(([kind, value]) => [
      kind,
      { sha256: sha256(value), bytes: Buffer.byteLength(value) },
    ]),
  );
  const sourceFacts = sourceSnapshot();
  writeFileSync(evidence + "/served-pm.js", bundle.js);
  writeFileSync(evidence + "/served-pm.css", bundle.css);
  return { fixture, base, bundle, bundleFacts, sourceFacts };
}
export function chromiumExecutable() {
  return [
    process.env.ERA_CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ]
    .filter(Boolean)
    .find((path) => existsSync(path));
}
export async function routeFixture(context, assets, writes, initial) {
  const origin = new URL(assets.base).origin;
  const state = {
    run: initial,
    failed: false,
    sessionFailed: false,
    commandFailure: false,
    simulated: [],
  };
  await context.addInitScript(
    () =>
      localStorage.getItem("pm-game-layer") === null &&
      localStorage.setItem("pm-game-layer", "on"),
  );
  await context.route("**/*", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!["GET", "HEAD"].includes(request.method())) {
      const body = request.postDataJSON();
      if (
        state.commandFailure &&
        url.pathname === "/api/delivery/v2/local" &&
        body?.action === "review" &&
        body.run_id === state.run.run_id
      ) {
        state.simulated.push({
          path: url.pathname,
          action: body.action,
          runId: body.run_id,
          effect: "browser fulfilled error; never sent to fixture/backend",
        });
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: '{"error":"Fixture review refused"}',
        });
      }
      writes.push({ path: url.pathname, method: request.method() });
      return route.abort();
    }
    const json = (data) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/app/assets/pm.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: assets.bundle.js,
      });
    if (url.pathname === "/app/assets/pm.css")
      return route.fulfill({
        contentType: "text/css",
        body: assets.bundle.css,
      });
    if (url.pathname === "/app/assets/brain-room.js")
      return route.fulfill({ contentType: "text/javascript", body: assets.bundle.room });
    if (url.pathname === "/api/delivery/v2/session" && state.sessionFailed)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Fixture session failure"}',
      });
    if (url.pathname === "/api/delivery/v2/session")
      return json({ paired: true, actor: "fixture", csrf: "fixture" });
    if (url.pathname === "/api/delivery/v2/local/run")
      return state.failed
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":"fixture request failure"}',
          })
        : json(state.run);
    if (url.pathname === "/api/delivery/sessions")
      return json({ sessions: [] });
    if (url.pathname === "/api/delivery/v2/runs")
      return json({ runs: [], requests: [] });
    if (url.pathname === "/api/delivery/v2/queue")
      return json({
        queue: {
          running: [],
          waiting: [],
          decisions: [],
          candidates: [],
          applying: null,
          unknown: { jobs: [] },
        },
      });
    if (url.pathname === "/api/delivery/v2/uat") return json({ handovers: [] });
    return route.continue();
  });
  return state;
}
let serial = 0;
export async function openBoard(page, state, assets, run, theme, seen = []) {
  state.run = run;
  state.failed = false;
  if (!page.url().startsWith(new URL(assets.base).origin))
    await page.goto(assets.base);
  await page.evaluate(
    ({ id, seen, theme }) => {
      localStorage.setItem("pm-local-attention:" + id, JSON.stringify(seen));
      localStorage.setItem("pm-app-theme", theme);
    },
    { id: run.run_id, seen, theme },
  );
  await page.goto(
    assets.base + "?board-fixture=" + ++serial + "#/delivery/run/" + run.run_id,
  );
  await page.waitForFunction(
    (value) => document.documentElement.dataset.theme === value,
    theme,
  );
  await page.locator(".board-workshop").waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".board-zone").length === 11 &&
      document.querySelector('[data-layer="static"]')?.width > 1,
  );
  await page.waitForTimeout(3000);
  // Baseline art/geometry is the explicit user-accessible fit, not retained
  // manual wheel/pan input delivered to a headed browser window.
  await page.evaluate(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.blur(),
  );
  await page.keyboard.press("0");
  await page.waitForTimeout(50);
}
