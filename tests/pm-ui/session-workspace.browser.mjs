// Run the credential-free fixtures/a5-browser.mjs first. This read-only browser
// fixture models 71 pending owner checks, not a four-item toy backlog.
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
const page = await browser.newPage({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const evidence =
  process.env.ERA_SESSION_EVIDENCE || ".pm/session-workspace-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [],
  writes = [],
  external = [];
let unavailable = false;
page.on("pageerror", (error) => errors.push(error.message));
const campaigns = [
  { name: "PM Tooling", prefix: "R", count: 23 },
  { name: "Delivery", prefix: "DLV-", count: 21 },
  { name: "Hub & ERA", prefix: "HUB-", count: 15 },
  { name: "Schedule", prefix: "SCH-", count: 9 },
  { name: "Budget", prefix: "BUD-", count: 3 },
];
const ownerItems = campaigns.flatMap((campaign) =>
  Array.from({ length: campaign.count }, (_, index) => ({
    campaign: campaign.name,
    id: `${campaign.prefix}${index + 1}`,
    title: `Owner test fixture ${campaign.prefix}${index + 1}`,
  })),
);
const at = new Date().toISOString();
const run = (run_id, extra) => ({
  run_id,
  engine: "v2",
  title: "Fixture session",
  alias: "BUD-4",
  file: "Budget/4 - Checklist.md",
  campaign: "Budget",
  lifecycle: "OPEN",
  closed_outcome: null,
  waiting_reason: null,
  executor: "codex",
  model: "synthetic-fixture",
  effort: "medium",
  stage: "implementation",
  branch: "IMPLEMENT",
  active: false,
  ownerAction: "Working",
  ownerActionKind: "none",
  created_at: at,
  updated_at: at,
  ...extra,
});
const runs = [
  run("fixture-running", { title: "Running fixture", active: true }),
  run("fixture-question", {
    title: "Owner question fixture",
    alias: "DLV-99",
    campaign: "Delivery",
    file: "Delivery/4 - Checklist.md",
    stage: "plan",
    ownerAction: "Answer question",
    ownerActionKind: "question",
  }),
  run("fixture-queued", {
    title: "Queued fixture",
    alias: "SCH-99",
    campaign: "Schedule",
    file: "Schedule/4 - Checklist.md",
    stage: "queued",
    waiting_reason: "capacity",
    ownerAction: "Queued",
  }),
  run("fixture-failed", {
    title: "Failed fixture",
    alias: "KIT-99",
    campaign: "Kitchen",
    file: "Kitchen/4 - Checklist.md",
    lifecycle: "CLOSED",
    closed_outcome: "failed",
    ownerAction: "Failed",
  }),
  run("fixture-verified", {
    title: "Verified candidate fixture",
    alias: "R99",
    campaign: "PM Tooling",
    file: "PM Tooling/4 - Checklist.md",
    lifecycle: "CLOSED",
    closed_outcome: "verified_candidate",
    ownerAction: "Verified candidate",
  }),
];
runs.push(
  run("fixture-unknown", {
    title: "Unconfirmed fixture",
    alias: "HUB-99",
    campaign: "Hub & ERA",
    file: "Hub & ERA/4 - Checklist.md",
    branch: "unknown",
    ownerAction: "Outcome unknown",
  }),
  run("fixture-cancelled", {
    title: "Cancelled fixture",
    alias: "KIT-98",
    campaign: "Kitchen",
    file: "Kitchen/4 - Checklist.md",
    lifecycle: "CLOSED",
    closed_outcome: "cancelled",
    ownerAction: "Cancelled",
  }),
);
const queueItem = (entry) => ({
  run_id: entry.run_id,
  alias: entry.alias,
  title: entry.title,
  campaign: entry.campaign,
  executor: entry.executor,
  model: entry.model,
  effort: entry.effort,
});
const queue = {
  limits: { maxWriters: 2, maxJobs: 2, fleetAllowance: null, unit: "tokens" },
  writers: { used: 1, max: 2 },
  jobs: { used: 1, max: 2 },
  running: [
    {
      ...queueItem(runs[0]),
      job_id: "fixture-job",
      access: "write",
      purpose: "implement",
      status: "running",
      writer: true,
      nativeAgents: 1,
    },
  ],
  waiting: [
    {
      ...queueItem(runs[2]),
      state: "queued",
      verdict: "wait",
      reasons: [],
      declared: [],
      intersects: [],
      sourceChanged: false,
    },
  ],
  decisions: [],
  candidates: [],
  applying: null,
  pairs: [],
  unknown: {
    jobs: [{ run_id: "fixture-unknown", job_id: "fixture-unknown-job" }],
    reservationsWithoutAmount: 0,
  },
  nativeAgents: 1,
};
await page.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") {
    external.push(url.hostname);
    return route.abort();
  }
  if (!["GET", "HEAD"].includes(request.method())) {
    writes.push(url.pathname);
    return route.abort();
  }
  const json = (body, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  if (url.pathname === "/api/data") {
    const response = await route.fetch(),
      data = await response.json();
    assert.ok(Array.isArray(data.files), "fixture source files");
    const replace = (relPath, raw) => {
      const existing = data.files.find((file) => file.relPath === relPath);
      if (existing) existing.raw = raw;
      else data.files.push({ relPath, raw });
    };
    for (const campaign of campaigns) {
      const items = ownerItems.filter(
        (item) => item.campaign === campaign.name,
      );
      replace(
        `${campaign.name}/4 - Checklist.md`,
        "# Checklist\n\n## Now\n\n## Next\n\n## Later\n",
      );
      replace(
        `${campaign.name}/${campaign.name} — Master Book.md`,
        `# ${campaign.name}\n\n## Acceptance Criteria Index\n` +
          items
            .map(
              (item) =>
                `### ${item.id}\n**Outcome:** ${item.title}.\n**Implementation:** done\n**UAT:** pending\n**Acceptance:** Open the fixture and confirm its visible title.\n**UAT instructions:** [Owner steps](<../../../docs/Session-Workspace-Fixture.md#${item.id.toLowerCase()}>)\n`,
            )
            .join("\n") +
          "\n## Shipped Log\n" +
          items
            .map((item) => `- ✅ 2026-11-13 — **${item.id}** ${item.title}.`)
            .join("\n"),
      );
    }
    return route.fulfill({ response, json: data });
  }
  if (url.pathname === "/api/delivery/sessions") return json({ sessions: [] });
  if (url.pathname === "/api/delivery/v2/session")
    return json({
      paired: true,
      actor: "synthetic-browser-fixture",
      csrf: "synthetic-no-writes",
    });
  if (url.pathname === "/api/delivery/v2/runs")
    return unavailable
      ? json({ error: "Synthetic session read unavailable" }, 503)
      : json({ runs, requests: [] });
  if (url.pathname === "/api/delivery/v2/queue") return json({ queue });
  if (url.pathname === "/api/delivery/v2/uat") {
    const campaign = url.searchParams.get("campaign"),
      id = url.searchParams.get("work_id");
    if (campaign && id)
      return json({
        campaign,
        id,
        title: `Owner test fixture ${id}`,
        handovers: [],
        preview: {
          available: id !== "SCH-9",
          revision: "a".repeat(64),
          sources: ["docs/Session-Workspace-Fixture.md#" + id.toLowerCase()],
          environment: { target: "local" },
          problems: [],
          content: {
            summary: `Owner test fixture ${id}`,
            setup: "",
            limits: "",
            scenarios:
              id === "SCH-9"
                ? []
                : [
                    {
                      id: "M1",
                      title: "Fixture display",
                      setup: "",
                      starting: "",
                      cleanup: "",
                      limits: null,
                      steps: [
                        {
                          action: "Open the fixture.",
                          expected: "Fixture appears.",
                        },
                        {
                          action: "Select details.",
                          expected: "Details appear.",
                        },
                      ],
                    },
                  ],
          },
        },
      });
    return json({
      handovers: [
        {
          handover_id: "fixture-question-draft",
          status: "draft",
          stale: false,
          created_at: at,
          subject: {
            type: "run",
            run_id: "fixture-question",
            work_id: "DLV-99",
            campaign: "Delivery",
            title: "Owner question fixture",
          },
          acceptance: { state: "pending" },
          scenarios: [],
        },
      ],
    });
  }
  return route.continue();
});
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const open = async (path) => {
  await page.goto(`${base}#/${path}`);
  await page.locator("main").waitFor();
};
const capture = async (name) => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name}: no horizontal overflow`,
  );
  await page.screenshot({
    path: `${evidence}/${name}.png`,
    animations: "disabled",
    fullPage: true,
  });
};
const laneButton = (lane) =>
  page.locator(`.session-state-rail button[data-state="${lane}"]`);
const selectLane = async (lane) => {
  await laneButton(lane).click();
  await page.waitForFunction(
    (value) =>
      document
        .querySelector(`.session-state-rail button[data-state="${value}"]`)
        ?.getAttribute("aria-pressed") === "true",
    lane,
  );
};
const cards = () => page.locator(".session-work-card");
const waitCards = async (count) =>
  page.waitForFunction(
    (value) => document.querySelectorAll(".session-work-card").length === value,
    count,
  );
const laneCounts = async (expected) =>
  page.waitForFunction(
    (values) =>
      Object.entries(values).every(
        ([lane, value]) =>
          document
            .querySelector(
              `.session-state-rail button[data-state="${lane}"] strong`,
            )
            ?.textContent.trim() === String(value),
      ),
    expected,
  );
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      await open("sessions");
      await page.locator(".session-workspace").waitFor();
      await page
        .locator('.session-source-status[data-current="true"]')
        .waitFor();
      await laneCounts({
        running: 1,
        needs: 1,
        uat: 71,
        waiting: 1,
        unknown: 1,
      });
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      await page
        .locator(
          '.session-state-rail button[data-state="needs"][aria-pressed="true"]',
        )
        .waitFor();
      await waitCards(1);
      assert.match(await cards().innerText(), /Owner question fixture/);
      assert.match(
        await cards().locator(".session-card-state").innerText(),
        /Answer question/,
      );
      assert.ok(
        await cards()
          .getByRole("link", { name: "Review", exact: true })
          .isVisible(),
      );
      assert.ok(
        await cards()
          .getByRole("link", { name: "Test steps pending", exact: true })
          .isVisible(),
        "draft tests remain secondary to the owner question",
      );
      assert.equal(
        await page.locator(".delivery-overview, .delivery-home-tabs").count(),
        0,
        "one Sessions workspace, no competing item/attempt dashboards",
      );
      await capture(`needs-${width}-${theme}`);
      await selectLane("running");
      await waitCards(1);
      assert.match(await cards().innerText(), /Running fixture/);
      assert.equal(await cards().getAttribute("data-state"), "running");
      await page.getByLabel("Find a session or test").fill("fixture-running");
      await waitCards(1);
      assert.match(await cards().innerText(), /Running fixture/);
      await page.getByLabel("Find a session or test").fill("");
      await capture(`running-${width}-${theme}`);
      await selectLane("waiting");
      await waitCards(1);
      assert.match(await cards().innerText(), /Queued fixture/);
      await selectLane("finished");
      await page.locator('.session-work-card[data-outcome="failed"]').waitFor();
      const failed = page.locator('.session-work-card[data-outcome="failed"]');
      const verified = page.locator(
        '.session-work-card[data-outcome="verified"]',
      );
      const cancelled = page.locator(
        '.session-work-card[data-outcome="cancelled"]',
      );
      assert.match(
        await failed.locator(".session-card-state").innerText(),
        /^Failed$/,
      );
      assert.match(
        await verified.locator(".session-card-state").innerText(),
        /^Candidate verified$/,
      );
      assert.match(
        await cancelled.locator(".session-card-state").innerText(),
        /^Cancelled$/,
      );
      assert.doesNotMatch(await failed.innerText(), /Completed|Accepted/);
      assert.doesNotMatch(await verified.innerText(), /Completed|Accepted/);
      assert.doesNotMatch(await cancelled.innerText(), /Completed|Accepted/);
      await capture(`finished-${width}-${theme}`);
      await selectLane("unknown");
      await waitCards(1);
      assert.match(await cards().innerText(), /Unconfirmed fixture/);
      assert.match(
        await cards().locator(".session-card-state").innerText(),
        /unconfirmed|unknown/i,
      );
      await selectLane("uat");
      await page.locator(".session-collections").waitFor();
      assert.equal(
        await page.locator(".session-collection").count(),
        5,
        "71 pending checks collapse into five campaign queues",
      );
      assert.equal(await cards().count(), 0, "no unbounded UAT item wall");
      assert.deepEqual(
        await page.locator(".session-collection > strong").allTextContents(),
        ["23", "21", "15", "9", "3"],
      );
      await capture(`test-campaigns-${width}-${theme}`);
      await page
        .locator(".session-collection")
        .filter({
          has: page.getByRole("heading", { name: "PM Tooling", exact: true }),
        })
        .click();
      await waitCards(6);
      const firstPage = await cards().locator("header b").allTextContents();
      assert.ok(
        await page
          .getByRole("button", { name: "Previous page", exact: true })
          .isDisabled(),
      );
      assert.match(
        await page.locator(".session-pagination").innerText(),
        /1–6 of 23/,
      );
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".session-pagination")
          ?.textContent.includes("7–12 of 23"),
      );
      await waitCards(6);
      assert.notDeepEqual(
        await cards().locator("header b").allTextContents(),
        firstPage,
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Previous page", exact: true })
          .isEnabled(),
      );
      await capture(`test-page-${width}-${theme}`);
      await page
        .getByRole("button", { name: "Campaigns", exact: true })
        .click();
      await page.locator(".session-collections").waitFor();
      await page.getByLabel("Find a session or test").fill("BUD-3");
      await waitCards(1);
      assert.match(await cards().innerText(), /Owner test fixture BUD-3/);
      const returnHash = new URL(page.url()).hash;
      await cards().getByRole("link", { name: "Test", exact: true }).click();
      await page.locator(".item-uat-preview").waitFor();
      assert.match(new URL(page.url()).hash, /^#\/uat-item\/Budget\/BUD-3\?/);
      await page
        .getByRole("heading", { name: "Open the fixture.", exact: true })
        .waitFor();
      assert.equal(
        (await page.locator(".uat-expect-box p").innerText()).trim(),
        "Fixture appears.",
      );
      assert.equal(
        await page.locator(".item-uat-preview .markdown, .reader-page").count(),
        0,
        "Test opens action and expected result, not Markdown",
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Previous", exact: true })
          .isDisabled(),
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Start test", exact: true })
          .isEnabled(),
      );
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page
        .getByRole("heading", { name: "Select details.", exact: true })
        .waitFor();
      assert.equal(
        (await page.locator(".uat-expect-box p").innerText()).trim(),
        "Details appear.",
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Next", exact: true })
          .isDisabled(),
      );
      await capture(`test-step-${width}-${theme}`);
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await page
        .getByRole("heading", { name: "Open the fixture.", exact: true })
        .waitFor();
      await page.getByRole("link", { name: "Back", exact: true }).click();
      await page.waitForURL((url) => url.hash === returnHash);
      await waitCards(1);
      assert.equal(
        await page.getByLabel("Find a session or test").inputValue(),
        "BUD-3",
      );
      await page
        .getByLabel("Find a session or test")
        .fill("nonexistent-session-item");
      await page
        .getByRole("heading", { name: "No matches", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Clear search", exact: true })
        .click();
      await page.locator(".session-collections").waitFor();
    }
  }
  await open("sessions?state=uat&q=SCH-9");
  await waitCards(1);
  await cards().getByRole("link", { name: "Test", exact: true }).click();
  await page
    .getByRole("heading", { name: "Test instructions missing", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start test", exact: true }).count(),
    0,
  );
  await capture("test-missing-390-pink");
  unavailable = true;
  await open("sessions?state=running");
  await page.reload();
  await page
    .getByText("Synthetic session read unavailable", { exact: false })
    .waitFor();
  await page.locator('.session-source-status[data-current="false"]').waitFor();
  await waitCards(1);
  await cards()
    .getByText("Last known · status unconfirmed", { exact: true })
    .waitFor();
  await capture("stale-running-390-pink");
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(external, []);
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        ok: true,
        widths: [1440, 390],
        themes: ["blue", "pink"],
        pendingUat: 71,
        campaignCollections: 5,
        pageSize: 6,
        sessionStates: true,
        boundedQueues: true,
        wizardPreviewSteps: true,
        missingInstructions: true,
        returnContext: true,
        staleState: true,
        errors,
        writes,
        external,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Sessions workspace browser PASS: desktop/mobile Blue/Pink, explicit session states, 71 owner checks grouped into five campaigns, six-card pagination/search, step-by-step per-item UAT, return context and stale evidence; zero writes.\n",
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
}
