// Browser-only Local receipts. Every request is fulfilled here, including writes.
import assert from "node:assert/strict";
import { buildApp } from "../../scripts/pm/app-build.mjs";
import { appAsset, buildAppShell } from "../../scripts/pm/app-shell.mjs";
import { boardRun, handover, passedChecks } from "./local-board-fixtures.ts";

const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const bundle = await buildApp();
const browser = await chromium.launch({ headless: true, executablePath: process.env.ERA_CHROME_PATH || undefined });
try {
  for (const [mode, theme, width] of [["off", "blue", 1280], ["on", "blue", 1440], ["on", "pink", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(({ mode, theme }) => {
      localStorage.setItem("pm-game-layer", mode);
      localStorage.setItem("pm-app-theme", theme);
    }, { mode, theme });
    const id = "local-00000000-0000-4000-8000-000000000168";
    const uat = handover();
    uat.subject.type = "direct";
    uat.subject.run_id = null;
    uat.subject.delivery_ref = "local:" + id;
    uat.signable = false;
    const run = boardRun({ run_id: id, base: "saved-base", head: "candidate", current_head: "candidate", checks: passedChecks(),
      activity: Array.from({ length: 69 }, (_, index) => ({ at: new Date(Date.UTC(2026, 10, 15, 12, 0, index)).toISOString(),
        kind: index % 5 === 0 ? "message" : "status", seq: index + 1, summary: "Recorded step " + (index + 1) })),
      phase: "uat-ready", handover: uat });
    const actions = [], errors = [], unknownWrites = [];
    const destination = "https://example.test/fixture/internal.git";
    const pushPlan = { action: "push", token: "push-witness", files: [], reason: null,
      commands: [["git", "push", "--force-with-lease", "internal", "main"]],
      cleanupCommands: [["git", "update-ref", "--stdin"]], cleanupInput: "delete refs/heads/delivery/R123 abcdef\n" };
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname;
      const json = (value, status = 200) => route.fulfill({ status, json: value });
      if (url.origin !== "http://127.0.0.1:4397") return route.abort();
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        actions.push(body.action);
        if (path.endsWith("/local") && body.action === "configure-push" && body.expected_url === destination) {
          run.publication = pushPlan;
          return json({ ok: true, setting: { url: destination }, destination });
        }
        if (path.endsWith("/uat") && body.action === "result") {
          uat.scenarios[0].result = "pass";
          uat.counts.pass = 1;
          uat.counts.pending = 0;
          uat.signable = true;
          return json({ ok: true, handover: uat });
        }
        if (path.endsWith("/uat") && body.action === "signoff") {
          uat.signoff = { received_at: new Date().toISOString(), build: "candidate" };
          uat.acceptance.state = "accepted";
          run.canMerge = true;
          return json({ ok: true, handover: uat });
        }
        if (path.endsWith("/local") && body.run_id === id) {
          if (body.action === "merge") {
            run.phase = "merged";
            run.applied = { at: "now", files: ["a file"], main_head: "base", pm_error: null };
            run.publication = { action: "commit", token: "commit-witness", files: ["a file"], reason: null, commands: [["git", "add", "--", "a file"], ["git", "commit", "-m", "R123 Board fixture"]] };
          } else if (body.action === "commit" && body.preview_id === "commit-witness") {
            run.phase = "committed";
            run.committed = { sha: "0123456789abcdef", at: "now" };
            run.publication = { action: "push", token: null, files: [], reason: "Set the push destination in Setup", commands: [] };
          } else if (body.action === "push" && body.preview_id === "push-witness") {
            run.phase = "pushed";
            run.pushed = { sha: run.committed.sha, at: "now", remote: "internal", branch: "main" };
            run.cleaned_at = "now";
            run.publication = null;
          } else { unknownWrites.push(body); return json({ error: "Unexpected command" }, 409); }
          return json({ ok: true });
        }
        unknownWrites.push(body);
        return json({ error: "Unexpected command" }, 409);
      }
      if (path === "/") return route.fulfill({ contentType: "text/html", body: buildAppShell() });
      const asset = appAsset(path, bundle);
      if (asset) return route.fulfill({ contentType: asset.type, body: asset.body });
      if (path === "/api/data") return json({ generatedAt: new Date().toISOString(), files: [] });
      if (path.endsWith("/health")) return json({ ok: true });
      if (path.endsWith("/session")) return json({ paired: true, csrf: "fixture", actor: "fixture" });
      if (path.endsWith("/command")) return json({ recorded: false }, 404);
      if (path.endsWith("/local/run")) return json(run);
      if (path.endsWith("/local/comparison")) {
        const file = url.searchParams.get("path");
        return file ? json({ patch: "@@ -1 +1 @@\n-old\n+" + file + " updated\n" }) :
          json({ base: url.searchParams.get("against") === "repo" ? "main-head" : "saved-base",
            files: ["first.ts", "second.ts"].map(path => ({ path, status: "M" })) });
      }
      if (path.endsWith("/local/push-settings")) return json({ setting: null, destination });
      if (path.endsWith("/v2/uat")) return json(url.searchParams.has("id") ? { handover: uat } : { handovers: [uat] });
      if (path.endsWith("/events")) return route.fulfill({ contentType: "text/event-stream", body: ": fixture\n\n" });
      return json({ runs: [], requests: [], sessions: [], queue: null });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    page.on("pageerror", error => errors.push(error.message));
    const runUrl = `http://127.0.0.1:4397/#/delivery/run/${id}`;
    const workflow = page.getByRole("region", { name: "Station inspector" });
    await page.goto(runUrl);
    if (mode === "on") {
      const rooms = page.getByRole("navigation", { name: "Delivery rooms" });
      const stations = page.getByRole("navigation", { name: "Owner workstations" });
      await workflow.getByRole("heading", { name: "Test", exact: true }).waitFor();
      await rooms.getByRole("button", { name: "AI room" }).click();
      await page.locator(".board-zone-name").first().waitFor();
      assert.equal(await page.locator(".board-zone-name").count(), 11);
      await page.getByRole("tab", { name: "Activity" }).click();
      const feed = page.getByRole("list", { name: "Mission feed" });
      await feed.waitFor();
      await page.getByRole("button", { name: "Older events" }).click();
      await page.getByRole("button", { name: "Older events" }).click();
      await feed.locator("li").last().scrollIntoViewIfNeeded();
      assert.equal(await feed.locator("li").count(), 69);
      await page.getByRole("button", { name: "Chat", exact: true }).click();
      await page.getByRole("region", { name: "Chat" }).waitFor();
      await rooms.getByRole("button", { name: "Owner room" }).click();
      await stations.getByRole("button", { name: "Merge", exact: true }).click();
      await workflow.getByLabel("Changed file").selectOption("second.ts");
      await workflow.getByText("+second.ts updated", { exact: true }).waitFor();
      await workflow.getByLabel("Compare against").selectOption("repo");
      await workflow.getByText("main-hea", { exact: true }).waitFor();
      await workflow.getByRole("button", { name: "Expand inspector" }).click();
      await workflow.getByRole("button", { name: "Restore room" }).click();
      await page.getByRole("button", { name: "Explore 3D" }).click();
      const world = page.locator('.era-brain[data-floor="owner"][data-view="walk"][data-load="ready"]');
      await world.waitFor();
      await stations.getByRole("button", { name: "Commit", exact: true }).click();
      await workflow.getByRole("heading", { name: "Commit", exact: true }).waitFor();
      await workflow.getByRole("button", { name: "Close inspector" }).click();
      await world.getByRole("button", { name: "Board", exact: true }).click();
      await stations.getByRole("button", { name: "Test", exact: true }).click();
      assert.deepEqual(actions, []);
    } else {
      await page.getByText("Session evidence", { exact: true }).click();
      await page.getByRole("tab", { name: "Brief" }).click();
      await page.getByRole("region", { name: "Plan", exact: true }).waitFor();
      await page.getByRole("tab", { name: "Verification" }).click();
      await page.getByRole("region", { name: "Verification" }).waitFor();
      await page.getByText("Session evidence", { exact: true }).click();
    }
    await workflow.getByRole("button", { name: "Test steps" }).click();
    assert.equal(page.url(), runUrl);
    await page.getByRole("button", { name: "Run app" }).waitFor();
    await page.getByRole("button", { name: "Pass", exact: true }).click();
    await page.getByRole("button", { name: "Sign off" }).click();
    await workflow.getByRole("button", { name: "Merge", exact: true }).click();
    await workflow.getByText('git add -- "a file"', { exact: false }).waitFor();
    if (mode === "on") await page.locator('.owner-room-station[data-station="commit"][aria-current="step"]').waitFor();
    await page.reload();
    await workflow.getByRole("button", { name: "Commit", exact: true }).click();
    await workflow.getByRole("button", { name: "Use internal/main" }).click();
    await workflow.getByText("delete refs/heads/delivery/R123 abcdef", { exact: false }).last().waitFor();
    await workflow.getByText("git push --force-with-lease internal main").waitFor();
    if (mode === "on") await page.locator('.owner-room-station[data-station="push"][aria-current="step"]').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await workflow.getByRole("button", { name: "Push", exact: true }).click();
    await workflow.getByRole("heading", { name: "Clean up", exact: true }).waitFor();
    await workflow.getByText("Complete", { exact: true }).waitFor();
    if (mode === "on") assert.equal(await page.locator('.owner-room-station[aria-current="step"]').count(), 0);
    assert.deepEqual(actions, ["result", "signoff", "merge", "commit", "configure-push", "push"]);
    assert.deepEqual(unknownWrites, []);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${mode === "on" ? "Game" : "Calm"} · ${width}px · sign-off → merge → reload → commit → push`);
  }
} finally {
  await browser.close();
}
