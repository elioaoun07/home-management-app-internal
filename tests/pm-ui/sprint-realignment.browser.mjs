// Run fixtures/a5-browser.mjs first. Writes only the isolated fixture's plan.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const fixture = JSON.parse(
  readFileSync(".pm/a5-evidence/fixture.json", "utf8"),
);
assert.ok(resolve(fixture.root).includes("era-a5-browser-"));
const file = join(
  fixture.root,
  "ERA Notes/10 - Project Management/_Planning.json",
);
const member = {
  workId: "BUD-1",
  origin: { file: "Budget/4 - Checklist.md", alias: "BUD-1" },
  points: 2,
  reviewMinutes: null,
};
const sprint = (id, startDate, endExclusive) => ({
  id,
  name: id,
  goal: "Keep original scope",
  startDate,
  endExclusive,
  timezone: "Asia/Beirut",
  strategy: "balanced",
  capacity: { unit: "points", available: 6, reviewMinutes: 90 },
  state: "draft",
  members: [member],
  commitment: null,
  scopeChanges: [],
  closed: null,
});
writeFileSync(
  file,
  JSON.stringify({
    schema: "pm-planning@1",
    revision: 0,
    commands: [],
    deliverables: [],
    sprints: [
      sprint("First week", "2026-11-09", "2026-11-16"),
      sprint("Second week", "2026-11-16", "2026-11-23"),
    ],
  })
    .replaceAll('"First week"', '"first"')
    .replaceAll('"Second week"', '"second"'),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const page = await browser.newPage({
  serviceWorkers: "block",
  reducedMotion: "reduce",
});
const errors = [],
  writes = [];
const evidence = ".pm/sprint-realignment-evidence";
mkdirSync(evidence, { recursive: true });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (!["GET", "HEAD"].includes(request.method())) {
    if (url.pathname !== "/api/delivery/v2/planning") return route.abort();
    writes.push(JSON.parse(request.postData()));
  }
  return route.continue();
});
const plan = () => JSON.parse(readFileSync(file, "utf8"));
try {
  for (const width of [1440, 390])
    for (const theme of ["blue", "pink"]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
      await page.goto(fixture.url + "/#/bridge");
      await page
        .getByRole("heading", { name: "Bridge", exact: true })
        .waitFor();
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      await page
        .locator(".primary-nav:visible")
        .getByRole("link", { name: "Plan", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Sprints", exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).hash, "#/sprints");
      const before = plan();
      await page.getByRole("button", { name: "Realign", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Realign sprints" });
      await dialog
        .getByLabel("First unfinished sprint", { exact: true })
        .fill("2026-11-14");
      await dialog.getByText("+5 days", { exact: true }).waitFor();
      assert.equal(plan().revision, before.revision);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${evidence}/preview-${width}-${theme}.png`,
        animations: "disabled",
        timeout: 10000,
      });
      await dialog.getByRole("button", { name: "Apply", exact: true }).click();
      await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
      assert.deepEqual(
        plan().sprints.map((week) => week.startDate),
        ["2026-11-14", "2026-11-21"],
      );
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".undo-notice"));
      assert.deepEqual(plan().sprints, before.sprints);
      assert.deepEqual(plan().deliverables, before.deliverables);
      await page.screenshot({
        path: `${evidence}/restored-${width}-${theme}.png`,
        animations: "disabled",
        timeout: 10000,
      });
      if (width === 390) {
        await page
          .getByRole("button", { name: "More navigation", exact: true })
          .click();
        await page.getByRole("link", { name: "Work", exact: true }).click();
      } else
        await page
          .getByRole("link", { name: "Search work", exact: true })
          .click();
      await page.getByLabel("Find work", { exact: true }).waitFor();
      assert.equal(
        await page
          .locator('.primary-nav:visible a[aria-current="page"]')
          .innerText(),
        "Plan",
      );
    }
  assert.deepEqual(errors, []);
  assert.equal(writes.length, 8);
  assert.ok(writes.every((entry) => entry.action === "realign"));
  const paths = [
    "scripts/pm/app/PrimaryNavigation.tsx",
    "scripts/pm/app/Sprints.tsx",
    "scripts/pm/shared/sprint-realignment.mjs",
    "scripts/pm/shared/planning.mjs",
    "scripts/pm/planning.mjs",
  ];
  const hashes = paths.map((path) => {
    const hash = (root) =>
      createHash("sha256")
        .update(readFileSync(join(root, path)))
        .digest("hex");
    const source = hash("."),
      tested = hash(fixture.root);
    assert.equal(source, tested);
    return { path, sha256: source };
  });
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        ok: true,
        widths: [1440, 390],
        themes: ["blue", "pink"],
        writes: writes.length,
        scope: "fixture-only planning realign and inverse; no dispatch",
        errors,
        hashes,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Sprint realignment browser PASS: Plan, preview, apply, Undo, Work filter; desktop/phone Blue/Pink.\n",
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.txt`,
    error.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw error;
} finally {
  await browser.close();
}
