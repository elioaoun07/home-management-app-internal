// End-to-end Start test + one observation, only inside a verified disposable
// a5-browser fixture. All other writes and every external request are refused.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { slugify } from "../../scripts/pm/shared/links.mjs";
const fixture = JSON.parse(
  readFileSync(".pm/a5-evidence/fixture.json", "utf8"),
);
const root = realpathSync(fixture.root),
  temporary = realpathSync(tmpdir());
assert.ok(
  root.toLowerCase().startsWith(temporary.toLowerCase() + "\\") ||
    root.startsWith(temporary + "/"),
  "Only a temporary fixture may be written",
);
assert.match(basename(root), /^era-a5-browser-/);
assert.notEqual(root, realpathSync("."));
assert.equal(readFileSync(join(root, "README.md"), "utf8"), "A5 fixture\n");
assert.ok(existsSync(join(root, "scripts/a5-fixture-driver.mjs")));
const base = new URL(fixture.url);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.protocol, "http:");
const bookPath = join(
  root,
  "ERA Notes/10 - Project Management/Budget/Budget — Master Book.md",
);
const originalBook = readFileSync(bookPath, "utf8");
const documentName = "Delivery-UAT-Agentic-OS-Browser-Fixture.md";
const docPath = resolve(root, "docs", documentName);
const originalDoc = existsSync(docPath) ? readFileSync(docPath, "utf8") : null;
const workId = `BUD-${Date.now()}`;
const title = `${workId} — Check browser fixture`;
assert.ok(
  !originalBook.includes(`### ${workId}\n`),
  "Integration test owns its temporary item",
);
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(
  docPath,
  `# Synthetic browser UAT\n\n## ${title}\n\n**Acceptance:** ${workId}\n\n### DISPLAY — Verify step navigation\n\n1. Read this first step. **Expected:** This first step is visible.\n2. Select the next step. **Expected:** This second step is visible.\n`,
);
writeFileSync(
  bookPath,
  originalBook.replace(
    "## Shipped Log",
    `### ${workId}\n**Outcome:** Check browser fixture.\n**Implementation:** done\n**UAT:** pending\n**UAT instructions:** [Owner steps](<../../../docs/${documentName}#${slugify(title)}>)\n**Acceptance:** The two authored steps are readable.\n\n## Shipped Log`,
  ),
);
const evidence = ".pm/session-workspace-evidence/start-test";
mkdirSync(evidence, { recursive: true });
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const page = await browser.newPage({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const errors = [],
  commands = [],
  refused = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.origin !== base.origin) {
    refused.push(url.origin);
    return route.abort();
  }
  if (!["GET", "HEAD"].includes(request.method())) {
    const body = request.postDataJSON();
    if (
      request.method() !== "POST" ||
      url.pathname !== "/api/delivery/v2/uat" ||
      !["start-item", "result"].includes(body.action)
    ) {
      refused.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    assert.ok(body.action !== "start-item" || body.work_id === workId);
    assert.ok(body.action !== "result" || body.result === "pass");
    commands.push(body.action);
  }
  return route.continue();
});
const readItem = () =>
  page.evaluate(async (workId) => {
    const session = await (await fetch("/api/delivery/v2/session")).json();
    const response = await fetch(
      `/api/delivery/v2/uat?campaign=Budget&work_id=${workId}`,
      { headers: { "x-era-csrf": session.csrf } },
    );
    if (!response.ok) throw new Error(`Item read failed ${response.status}`);
    return response.json();
  }, workId);
try {
  await page.goto(
    `${base}#/uat-item/Budget/${workId}?from=${encodeURIComponent("/sessions?state=uat&campaign=Budget")}`,
  );
  await page.locator(".item-uat-preview").waitFor();
  const before = await readItem();
  assert.equal(before.preview.available, true);
  assert.equal(
    before.handovers.length,
    0,
    "Passive preview creates no handover",
  );
  assert.equal(before.preview.content.scenarios[0].steps.length, 2);
  assert.equal(
    await page.locator("#item-uat-step-title").innerText(),
    "Read this first step.",
  );
  await page.getByRole("button", { name: "Start test", exact: true }).click();
  await page.locator("#uat-step-title").waitFor();
  assert.equal(await page.locator(".item-uat-preview").count(), 0);
  assert.equal(
    await page.locator("#uat-step-title").innerText(),
    "Read this first step.",
  );
  assert.equal(
    await page.locator(".uat-expect-box p").innerText(),
    "This first step is visible.",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("heading", { name: "Select the next step.", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".uat-expect-box p").innerText(),
    "This second step is visible.",
  );
  await page.getByRole("button", { name: "Pass", exact: true }).click();
  await page
    .locator(
      '.uat-result-buttons button[data-tone="pass"][aria-pressed="true"]',
    )
    .waitFor();
  const after = await readItem();
  assert.equal(after.handovers.length, 1);
  assert.equal(after.handovers[0].subject.work_id, workId);
  assert.equal(after.handovers[0].status, "ready");
  assert.equal(after.handovers[0].scenarios[0].result, "pass");
  const id = after.handovers[0].handover_id;
  await page.reload();
  await page
    .locator(
      '.uat-result-buttons button[data-tone="pass"][aria-pressed="true"]',
    )
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start test", exact: true }).count(),
    0,
    "Existing result resumes instead of creating a second handover",
  );
  const resumed = await readItem();
  assert.equal(resumed.handovers.length, 1);
  assert.equal(resumed.handovers[0].handover_id, id);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const resultTargets = await page
    .locator(".uat-result-buttons button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        const lines = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode())
          if (node.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            lines.push(range.getClientRects().length);
          }
        return {
          label: button.textContent.trim(),
          height: button.getBoundingClientRect().height,
          lines,
        };
      }),
    );
  assert.ok(
    resultTargets.every(
      (target) =>
        target.height >= 40 && target.lines.every((count) => count === 1),
    ),
    `Mobile result targets: ${JSON.stringify(resultTargets)}`,
  );
  await page.screenshot({
    path: `${evidence}/resumed-390.png`,
    animations: "disabled",
    fullPage: true,
  });
  writeFileSync(
    docPath,
    readFileSync(docPath, "utf8").replace(
      "Read this first step.",
      "Read the revised first step.",
    ),
  );
  await page.reload();
  await page.locator(".item-uat-preview").waitFor();
  assert.equal(
    await page.locator("#item-uat-step-title").innerText(),
    "Read the revised first step.",
  );
  assert.equal(
    (await readItem()).handovers.length,
    1,
    "Changed instructions only preview; no automatic new attempt",
  );
  await page.getByRole("button", { name: "Start test", exact: true }).click();
  await page.locator("#uat-step-title").waitFor();
  assert.equal(
    await page.locator("#uat-step-title").innerText(),
    "Read the revised first step.",
  );
  const revised = await readItem();
  assert.equal(revised.handovers.length, 2);
  const current = revised.handovers.find((entry) => entry.handover_id !== id);
  assert.equal(
    current.scenarios[0].result,
    "pending",
    "A new instruction revision cannot inherit the old Pass",
  );
  assert.equal(
    revised.handovers.find((entry) => entry.handover_id === id).scenarios[0]
      .result,
    "pass",
    "Historical observations remain readable",
  );
  assert.deepEqual(commands, ["start-item", "result", "start-item"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(refused, []);
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        ok: true,
        fixture: root,
        previewHasNoWrites: true,
        actualStart: true,
        authoredSteps: true,
        observationPersisted: true,
        reloadResumes: true,
        revisedInstructionsPreview: true,
        newAttemptHasNoInheritedPass: true,
        commands,
        errors,
        refused,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Item UAT integration PASS: preview has no writes; Start test records a fresh attempt; Pass persists; changed instructions preview and start without inherited results; only three fixture-local UAT writes.\n",
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.txt`,
    `${error.stack}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await browser.close();
  writeFileSync(bookPath, originalBook);
  if (originalDoc === null) unlinkSync(docPath);
  else writeFileSync(docPath, originalDoc);
}
