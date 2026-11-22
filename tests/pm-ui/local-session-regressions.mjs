import assert from "node:assert/strict";

// R123 regressions found by the independent source audit. All API replies remain synthetic.
export async function checkSessionRegressions({ page, open, selectTool, openOwnerDiff, capture, controls, id }) {
  await open(`/delivery/run/${id}`, "shipped", "blue");
  await openOwnerDiff();
  await page.getByRole("region", { name: "Code diff" }).getByText("+fixture-only-first-run", { exact: true }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Changed file" }).locator("option").count(), 1);
  await page.getByRole("button", { name: "AI room", exact: true }).click();
  await page.getByRole("button", { name: "Recorder", exact: true }).click();
  const recorder = page.getByRole("slider", { name: "Replay", exact: true });
  await recorder.focus();
  await recorder.press("Home");
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.replay === "true");
  assert.equal(await page.locator(".run-game-patch").count(), 0, "an early replay cannot disclose a future patch");
  assert.equal(await page.locator(".run-game-files li").count(), 0, "an early replay cannot disclose future diff filenames");
  assert.equal((await page.getByRole("tab", { name: "Changes", exact: false }).innerText()).trim(), "Changes", "the Changes count cannot disclose a future file");
  await openOwnerDiff();
  await page.getByText("Comparison available in Live", { exact: true }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Code diff" }).count(), 0);
  assert.equal(await page.getByRole("combobox", { name: "Changed file" }).count(), 0);
  await page.getByRole("button", { name: "AI room", exact: true }).click();
  await selectTool("Activity");
  assert.equal(await page.locator('.run-game-events li[data-kind="edit"],.run-game-events li[data-kind="check"]').count(), 0,
    "early Activity contains only the replay frame's recorded events");
  await capture("replay-future-patch-files-and-counters-masked");

  await open(`/delivery/run/${id}`, "shipped", "blue");
  controls.extraRows = Array.from({ length: 35 }, (_, index) => ({ at: controls.iso(1000 + index), kind: "status", summary: `Recorded retained observation ${index}`, seq: 300 + index, job_id: "native" }));
  await page.waitForResponse(response => new URL(response.url()).pathname === "/api/delivery/v2/local/run");
  const summary = page.locator('.board-attention-card[data-kind="summary"]');
  await summary.waitFor();
  const fullText = await summary.locator(".board-attention-detail").textContent();
  await summary.getByRole("button", { name: "Open", exact: true }).click();
  const target = page.locator('.run-game-events li[data-event-id="native:5"]');
  await target.waitFor();
  assert.equal(await target.locator("details").getAttribute("open"), "", "Summary Open expands its exact retained row");
  assert.equal(await target.locator("pre").textContent(), fullText, "Summary Open exposes the full recorded message");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-event-id") === "native:5");
  assert.ok(await page.locator(".run-game-events li").count() <= 31, "a summary beyond the thirty-row feed is targeted without unbounding the feed");
  await capture("summary-opens-full-recorded-message-beyond-feed-window");
}
