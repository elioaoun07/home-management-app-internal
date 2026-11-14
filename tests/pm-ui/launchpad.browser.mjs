// Start fixtures/a5-browser.mjs --launchpad first. Uses an existing Playwright
// installation via ERA_PLAYWRIGHT_MODULE; no install, credentials or inference.
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
  viewport: { width: 1440, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage(),
  errors = [],
  requests = [];
const evidence = ".pm/a6-evidence";
mkdirSync(evidence, { recursive: true });
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.method() === "POST")
    requests.push(new URL(request.url()).pathname);
});
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
const url = process.env.ERA_A6_URL || "http://127.0.0.1:4397/#/launch";
try {
  await page.goto(url);
  await page.getByRole("heading", { name: "Launch", exact: true }).waitFor();
  await page.getByRole("button", { name: "New module new-module" }).click();
  assert.equal(await page.getByLabel(/^Title/).inputValue(), "");
  await page
    .getByLabel("Skill", { exact: true })
    .locator("option")
    .last()
    .waitFor({ state: "attached" });
  assert.equal(
    await page.getByLabel("Skill", { exact: true }).locator("option").count(),
    8,
  );
  await page.getByLabel(/^Slug/).fill("launchpad-parcels");
  await page.getByLabel(/^One line/).fill("Track incoming parcels");
  assert.equal(
    await page.getByLabel(/^Title/).inputValue(),
    "Launchpad Parcels",
  );
  assert.equal(
    await page.getByLabel(/^Table/).inputValue(),
    "launchpad_parcels",
  );
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  const prompt = page.getByLabel("Rendered prompt", { exact: true });
  await prompt.waitFor();
  const text = await prompt.innerText();
  assert.match(text, /"name": "launchpad-parcels"/);
  assert.match(text, /"intent": "Launchpad Parcels"/);
  assert.match(text, /"noPage": false/);
  assert.doesNotMatch(text, /"connects"/);
  await page.getByText("Dry run", { exact: true }).click();
  assert.match(await page.locator("body").innerText(), /DRY RUN/);
  assert.equal(
    await page.getByRole("button", { name: "Worktree", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await page.getByText("Copied", { exact: true }).waitFor();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      "\r\n",
      "\n",
    ),
    text,
  );
  await page.getByRole("button", { name: "Copy command", exact: true }).click();
  const command = (
    await page.evaluate(() => navigator.clipboard.readText())
  ).replaceAll("\r\n", "\n");
  assert.match(
    command,
    /^claude --model 'claude-sonnet-5-5' --effort 'medium'/,
  );
  assert.ok(command.includes('"name": "launchpad-parcels"'));
  assert.ok(command.includes('"oneLiner": "Track incoming parcels"'));
  await page.screenshot({
    path: `${evidence}/launch-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${evidence}/launch-mobile-blue.png`,
    fullPage: true,
  });
  // Changing an input must retire the old prepared result and its copy buttons.
  await page.getByLabel(/^Slug/).fill("launchpad-parcels-edited");
  assert.equal(
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .count(),
    0,
  );
  await page.getByLabel(/^Type/).selectOption("junction");
  const connects = page.getByLabel(/^Connects/);
  await connects.selectOption(["Transactions", "Recipes"]);
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await prompt.waitFor();
  assert.match(await prompt.innerText(), /"Transactions"/);
  await page.evaluate(() => localStorage.setItem("pm-app-theme", "pink"));
  await page.reload();
  await page.getByRole("button", { name: "New module new-module" }).click();
  await page.getByLabel(/^Slug/).fill("launchpad-pink");
  await page.getByLabel(/^One line/).fill("Track parcels");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await prompt.waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "pink");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${evidence}/launch-mobile-pink.png`,
    fullPage: true,
  });
  await page.getByLabel("Recipe", { exact: true }).selectOption("money-bug");
  assert.equal(
    await page.getByLabel("Skill", { exact: true }).inputValue(),
    "fix-bug",
  );
  assert.equal(
    await page.getByLabel("Tier", { exact: true }).inputValue(),
    "CLAUDE_HIGH",
  );
  await page.getByLabel("Symptom", { exact: true }).fill("Wrong amount");
  await page.getByLabel(/^Module/).selectOption("Transactions");
  await page.getByLabel(/^Reproduction/).fill("Save a transaction");
  await page.getByLabel(/^Expected/).fill("Correct amount");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await prompt.waitFor();
  assert.match(await prompt.innerText(), /money-rules\/SKILL.md/);
  assert.equal(
    await page
      .getByLabel("Tier", { exact: true })
      .locator('option[value="CODEX_HIGH"]')
      .getAttribute("disabled"),
    "",
  );
  await page.getByLabel("Skill", { exact: true }).selectOption("triage-inbox");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await prompt.waitFor();
  assert.match(await prompt.innerText(), /\/triage-inbox/);
  assert.deepEqual(errors, []);
  assert.ok(requests.every((path) => path === "/api/launchpad"));
  writeFileSync(
    `${evidence}/browser-result.json`,
    JSON.stringify(
      {
        ok: true,
        forms: 8,
        completeCopyFlow: "new-module",
        followUpInputQuestions: 0,
        dryRun: true,
        realClipboard: true,
        junction: true,
        staleResultRetired: true,
        recipe: "money-bug",
        zeroInput: "triage-inbox",
        mobileWidths: [390],
        themes: ["blue", "pink"],
        worktree: "disabled: Local lane has no skill-prompt contract",
        errors,
        requests,
        prompt: text,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `A6 browser: PASS (copy prompt/command, defaults, junction, stale result, recipe, 390px blue/pink, zero-input)\n`,
  );
} catch (error) {
  writeFileSync(
    `${evidence}/browser-failure.txt`,
    `${error.stack}\n${await page.locator("body").innerText()}\n${await page.locator("select").evaluateAll((els) => els.map((e) => e.outerHTML).join("\n"))}`,
  );
  await page.screenshot({
    path: `${evidence}/browser-failure.png`,
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
