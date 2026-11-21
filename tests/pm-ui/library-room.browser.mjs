// Entirely browser-fulfilled, including local Start, receipts, and the run.
import assert from "node:assert/strict";
import { mkdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { buildApp } from "../../scripts/pm/app-build.mjs";
import { appAsset, buildAppShell } from "../../scripts/pm/app-shell.mjs";

const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const bundle = await buildApp();
const evidence = ".pm/library-room-evidence";
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.ERA_CHROME_PATH, headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const campaigns = { Budget: "BUD", Schedule: "SCH", Kitchen: "KIT", "Hub & ERA": "HUB",
  Trips: "TRIP", Outfits: "OUT", Healthcare: "HLTH", Delivery: "DLV", "PM Tooling": "R",
  "Notifications & Alerts": "NOTIF", "Native App": "NAT" };
const files = Object.entries(campaigns).flatMap(([campaign, prefix]) => {
  const id = prefix === "R" ? "R1" : `${prefix}-1`;
  const title = campaign === "Budget" ? "Review the household budget" : `Review ${campaign}`;
  return [
    { relPath: `${campaign}/4 - Checklist.md`, raw: `# Checklist\n## Now\n- [ ] **${id}** ${title} — [criteria](<${campaign} — Master Book.md#${id.toLowerCase()}>) _(friction - M)_\n\n## Next\n\n## Later\n` },
    { relPath: `${campaign}/${campaign} — Master Book.md`, raw: `# ${campaign}\n## Acceptance Criteria Index\n### ${id}\n**Outcome:** A readable monthly summary.\n**Acceptance:** Every category has a total.\n**Plan:** Group the entries by category.\n\n## Shipped Log\n${prefix === "BUD" ? "- ✅ 2026-10-10 — **BUD-2** Close the previous month." : ""}\n` },
  ];
});
const errors = [];
const base = "http://127.0.0.1:4399";
const session = { paired: true, actor: "library-fixture", scope: "library-fixture", csrf: "fixture" };
const run = {
  run_id: "local-library-fixture", phase: "preparing", workspace: "fixture", branch: "fixture", head: null,
  current_head: null, canShip: false, canUndo: false, interrupted: false,
  work: { id: "BUD-1", title: "Review the household budget", campaign: "Budget", brief: "A readable monthly summary." },
  settings: { executor: "codex", model: "sample-codex", effort: "high" }, checks: [], activity: [],
  usage: null, handover: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

async function exercise(width, motion, webgl) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 },
    reducedMotion: motion, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", error => {
    const frame = error.stack?.match(/\/app\/assets\/(pm|brain-room)\.js:(\d+):(\d+)/);
    const source = frame && (frame[1] === "pm" ? bundle.js : bundle.room).split("\n")[Number(frame[2]) - 1];
    const col = frame ? Number(frame[3]) - 1 : 0;
    errors.push({ width, route: page.url(), stack: error.stack, near: source?.slice(Math.max(0, col - 120), col + 120) });
  });
  const starts = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    assert.equal(url.origin, base);
    const json = (value, status = 200) => route.fulfill({ json: value, status });
    if (route.request().method() === "POST") {
      assert.equal(path, "/api/delivery/v2/local");
      const body = route.request().postDataJSON();
      assert.equal(body.action, "start");
      starts.push(body);
      if (starts.length === 1) return json({ ok: false, error: "local-preflight-failed",
        readiness: { ready: false, facts: { source: { state: "fail", code: "commit-or-stash-changes" } } } }, 409);
      return json({ ok: true, run_id: run.run_id });
    }
    if (path === "/") return route.fulfill({ contentType: "text/html", body: buildAppShell() });
    if (!webgl && path === "/app/assets/brain-room.js") return route.abort();
    const asset = appAsset(path, bundle);
    if (asset) return route.fulfill({ contentType: asset.type, body: asset.body });
    if (path.startsWith("/assets/") && existsSync(join("scripts/pm/assets", basename(path))))
      return route.fulfill({ path: join("scripts/pm/assets", basename(path)) });
    if (path === "/api/data") return json({ files, generatedAt: new Date().toISOString() });
    if (path === "/api/library/record") {
      assert.equal(url.searchParams.get("id"), "BUD-2");
      return json({ file: "_Archive/Shipped/Budget.md", body: "**Outcome:** A closed month.\n**Acceptance:** The previous month is archived." });
    }
    if (path === "/api/events") return route.fulfill({ contentType: "text/event-stream", body: "retry: 60000\n\n" });
    if (path === "/api/health") return json({ ok: true });
    if (path === "/api/delivery/sessions") return json({ sessions: [] });
    if (path === "/api/delivery/v2/session") return json(session);
    if (path === "/api/delivery/v2/runs") return json({ runs: [], requests: [] });
    if (path === "/api/delivery/v2/command") return json({ error: "unrecorded" }, 404);
    if (path === "/api/delivery/v2/local/run") {
      assert.equal(url.searchParams.get("id"), run.run_id);
      return json(run);
    }
    if (path === "/api/delivery/v2/executors") return json({ executors: ["codex", "claude"].map(id => ({
      id, label: id, models: [{ id: "sample-" + id }], supportedEfforts: ["low", "high"], suggestions: {},
    })), refusals: [], policy: null });
    return json({}, 404);
  });
  const main = page.getByRole("main");
  const snap = async name => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow on ${name} at ${width}`);
    await page.screenshot({ path: `${evidence}/${width}-${name}.png`, animations: "disabled" });
  };
  try {
    await page.goto(base + "/#/explore");
    await page.getByLabel("Find work").waitFor();
    assert.equal(await main.getByRole("link", { name: "Library", exact: true }).count(), 0);
    await page.getByRole("switch", { name: "Game layer" }).click();
    await page.getByRole("link", { name: "Search work" }).click();
    await page.getByLabel("Find work").fill("monthly");
    await main.getByRole("link", { name: "Library", exact: true }).click();
    await page.locator(`.orbital-library[data-view="${webgl ? "3d" : "illustrated"}"]`).waitFor();
    const gallery = page.getByRole("region", { name: "Library room" });
    if (!webgl) await page.locator(".orbital-painted-sky canvas").waitFor();
    await gallery.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await snap("observatory");
    const directory = page.getByRole("navigation", { name: "Library cabinets" });
    assert.equal(await directory.getByRole("button").count(), 11);
    for (const [campaign, id, medium] of [["Kitchen", "KIT-1", "book"], ["Hub & ERA", "HUB-1", "glass"], ["Budget", "BUD-1", "tablet"]]) {
      await directory.getByRole("button", { name: campaign, exact: true }).click();
      await page.locator(`.lc-cabinet[data-medium="${medium}"]`).waitFor();
      for (const name of ["To do now", "Next", "Blocked", "Later", "Finished"])
        await page.getByRole("region", { name, exact: true }).waitFor();
      if (campaign === "Budget") {
        await snap("shelves");
        await page.locator('[data-volume="BUD-2"]').click();
        await page.getByText("The previous month is archived.", { exact: false }).first().waitFor();
        assert.equal(await main.getByRole("button", { name: "Deliver", exact: true }).count(), 0);
        await main.getByRole("button", { name: "Budget shelves", exact: true }).click();
      }
      await page.locator(`[data-volume="${id}"]`).click();
      await page.getByRole("heading", { name: "What done looks like" }).waitFor();
      await page.getByText("Every category has a total.", { exact: false }).first().waitFor();
      await snap(medium);
      await main.getByRole("button", { name: "Plan brief", exact: true }).click();
      await page.getByText(/Group the entries by category/).first().waitFor();
      await main.getByRole("button", { name: "Checklist", exact: true }).click();
      await main.getByRole("heading", { name: "Checklist" }).waitFor();
      if (campaign === "Budget") break;
      await main.getByRole("button", { name: campaign + " shelves", exact: true }).click();
      await main.getByRole("button", { name: "Library", exact: true }).click();
    }
    await main.getByRole("button", { name: "Deliver", exact: true }).click();
    const operator = width < 500 ? "claude" : "codex";
    await main.getByRole("button", { name: operator === "claude" ? "Claude" : "Codex", exact: true }).click();
    await page.getByLabel("Model", { exact: true }).selectOption("sample-" + operator);
    await page.getByLabel("Effort", { exact: true }).selectOption("high");
    await snap("crew");
    await main.getByRole("button", { name: "Start", exact: true }).click();
    await main.getByRole("heading", { name: "Start blocked" }).waitFor();
    assert.ok(page.url().includes("/deliver/Budget/BUD-1"));
    await main.getByRole("button", { name: "Start", exact: true }).click();
    await page.waitForURL("**/#/delivery/run/local-library-fixture?arrival=library");
    await page.locator(`.era-brain[data-view=walk][data-load=${webgl ? "ready" : "failed"}]`).waitFor();
    if (webgl) {
      await page.locator(".library-eyes").waitFor({ state: "detached" });
      await snap("arrival");
    } else {
      await main.getByRole("button", { name: "Open board", exact: true }).waitFor();
    }
    assert.equal(starts.length, 2);
    for (const body of starts) {
      assert.deepEqual([body.id, body.file, body.executor, body.model, body.effort], [
        "BUD-1", "Budget/4 - Checklist.md", operator, "sample-" + operator, "high"]);
    }
    assert.notEqual(starts[0].command_id, starts[1].command_id);
  } finally {
    await context.close();
  }
}
try {
  await exercise(1366, "no-preference", true);
  await exercise(390, "reduce", false);
  assert.deepEqual(errors, []);
  process.stdout.write("Library passed on desktop and mobile, including both operators, blocked admission, and confirmed room arrival.\n");
} finally {
  await browser.close();
}
