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
const evidence =
  process.env.ERA_A6_EVIDENCE || ".pm/work-entry-evidence/prompt-tools";
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
const url = process.env.ERA_A6_URL || "http://127.0.0.1:4397/#/skill-tools";
const composer = page.getByLabel("Prompt", { exact: true });
const choose = async (skill) => {
  await page.getByLabel("Find a skill", { exact: true }).fill(skill);
  await page.getByRole("button", { name: `/${skill}`, exact: true }).click();
  await page.getByLabel("Find a skill", { exact: true }).fill("");
};
const settings = async () => {
  const summary = page.getByText("Context & settings", { exact: true });
  if (!(await summary.locator("..").evaluate((el) => el.open)))
    await summary.click();
};
try {
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Prompt tools", exact: true })
    .waitFor();
  await composer.waitFor();
  const prepareButton = page.getByRole("button", {
    name: "Review prompt",
    exact: true,
  });
  assert.equal(await prepareButton.isDisabled(), true);
  await composer.fill("/new");
  await composer.press("Enter");
  assert.equal(await composer.inputValue(), "/new-module ");
  assert.equal(await prepareButton.isDisabled(), true);
  await composer.fill("/unknown-skill Test");
  await page.getByText("Choose a registered skill", { exact: true }).waitFor();
  assert.equal(await prepareButton.isDisabled(), true);
  await composer.fill("/fix");
  await composer.press("Tab");
  assert.equal(await composer.inputValue(), "/fix-bug ");
  await composer.fill("/era-wire Wire the reported action");
  const beforeMissingReport = requests.length;
  await prepareButton.click();
  assert.equal(
    await page
      .getByLabel("ERA report", { exact: true })
      .evaluate((el) => el.validity.valueMissing),
    true,
  );
  assert.equal(requests.length, beforeMissingReport);
  await composer.fill("");
  await page.screenshot({
    path: `${evidence}/composer-desktop.png`,
    fullPage: true,
  });
  const freeText =
    'Add a favorites filter. Keep "all" as the default.\nPreserve my wording.';
  await composer.fill(`/add-feature ${freeText}`);
  await page.getByLabel("Module", { exact: true }).selectOption("Recipes");
  await settings();
  await page.getByLabel("Target paths", { exact: true }).fill("README.md");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  const freeResult = page.getByLabel("Rendered prompt", { exact: true });
  await freeResult.waitFor();
  const freePrompt = await freeResult.innerText();
  assert.ok(freePrompt.startsWith("/add-feature"));
  assert.ok(freePrompt.includes(freeText));
  assert.ok(freePrompt.includes("Recipes"));
  assert.match(freePrompt, /Target paths:\n- README\.md/);
  assert.doesNotMatch(freePrompt, /Inputs \(complete|BUD-1/);
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await page.getByText("Copied", { exact: true }).waitFor();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      "\r\n",
      "\n",
    ),
    freePrompt,
  );
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  assert.equal(
    await page.getByLabel("Target paths", { exact: true }).inputValue(),
    "README.md",
  );
  assert.equal(
    await page.getByLabel("Request", { exact: true }).inputValue(),
    freeText,
  );
  assert.equal(await page.getByLabel(/^Module/).inputValue(), "Recipes");
  await page.getByLabel(/^Module/).selectOption("Catalogue");
  await page.getByRole("button", { name: "Prompt", exact: true }).click();
  assert.equal(await composer.inputValue(), `/add-feature ${freeText}`);
  assert.equal(
    await page.getByLabel("Module", { exact: true }).inputValue(),
    "Catalogue",
  );
  await composer.fill(`/add-feature ${freeText} Keep archived recipes hidden.`);
  assert.equal(
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .count(),
    0,
  );
  await choose("pwa-install");
  assert.ok((await composer.inputValue()).includes(freeText));
  assert.ok((await composer.inputValue()).startsWith("/pwa-install"));
  await composer.fill("/pwa-install Check the Trips install identity");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await freeResult.waitFor();
  assert.ok((await freeResult.innerText()).startsWith("/pwa-install"));
  await composer.fill("/add-feature Add a favorites filter");
  await settings();
  await page.getByLabel("Work item", { exact: true }).selectOption("BUD-1");
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await freeResult.waitFor();
  assert.ok((await freeResult.innerText()).includes("BUD-1"));
  await page.getByLabel("Work item", { exact: true }).selectOption("");
  assert.equal(
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Work item", { exact: true }).selectOption("BUD-1");
  await choose("new-module");
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  assert.equal(
    await page.getByLabel("Module", { exact: true }).inputValue(),
    "Catalogue",
  );
  assert.equal(
    await page.getByLabel("Work item", { exact: true }).inputValue(),
    "BUD-1",
  );
  assert.equal(await page.getByLabel(/^Title/).inputValue(), "");
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
  assert.match(text, /Target paths:\n- README\.md/);
  assert.match(text, /"module": "Catalogue"/);
  assert.match(text, /"item": "BUD-1"/);
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
  await choose("new-module");
  await page.getByRole("button", { name: "Guided", exact: true }).click();
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
  await choose("fix-bug");
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  await settings();
  await page.getByLabel("Preset", { exact: true }).selectOption("money-bug");
  assert.equal(
    await page
      .getByLabel("Preset", { exact: true })
      .locator('option[value="era-report"]')
      .count(),
    0,
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
  await choose("triage-inbox");
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  await settings();
  assert.equal(
    await page.getByLabel("Tier", { exact: true }).inputValue(),
    "CLAUDE_MID",
  );
  await page
    .getByRole("button", { name: "Review prompt", exact: true })
    .click();
  await prompt.waitFor();
  assert.match(await prompt.innerText(), /\/triage-inbox/);
  for (const theme of ["blue", "pink"]) {
    await page.evaluate(
      (value) => localStorage.setItem("pm-app-theme", value),
      theme,
    );
    await page.reload();
    await composer.waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    await composer.fill("/fix-bug The save button does nothing");
    await page.getByLabel("Module", { exact: true }).selectOption("Recipes");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${evidence}/composer-mobile-${theme}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Review prompt", exact: true })
      .click();
    await prompt.waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${evidence}/review-mobile-${theme}.png`,
      fullPage: true,
    });
  }
  // Failed preparation exposes feedback and can be retried from the same draft.
  await composer.fill("/fix-bug Retry after a validation failure");
  await page.route(
    "**/api/launchpad",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fixture validation unavailable" }),
      }),
    { times: 1 },
  );
  await prepareButton.click();
  await page
    .locator(".launch-notice")
    .filter({ hasText: "Fixture validation unavailable" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await composer.inputValue(),
    "/fix-bug Retry after a validation failure",
  );
  await prepareButton.click();
  await prompt.waitFor();
  assert.match(await prompt.innerText(), /Retry after a validation failure/);
  assert.deepEqual(errors, []);
  assert.ok(requests.every((path) => path === "/api/launchpad"));
  writeFileSync(
    `${evidence}/browser-result.json`,
    JSON.stringify(
      {
        ok: true,
        forms: 8,
        freePrompt: true,
        optionalWorkItem: true,
        skillWithoutForm: "pwa-install",
        skillSwitchPreservesPrompt: true,
        modeSwitchPreservesContext: true,
        guidedTargetPaths: true,
        guidedSharedContext: true,
        skillSwitchClearsPreset: true,
        slashKeyboardCompletion: true,
        emptyUnknownBlocked: true,
        eraReportRequired: true,
        failedPrepareRetry: true,
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
    `Launch browser PASS (free prompt, optional work, skill without form, copy prompt/command, guided defaults, junction, stale result, preset, 390px blue/pink)\n`,
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
