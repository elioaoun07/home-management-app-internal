// R123: isolated credential-free API fixture, exact root assets, test-only art/probes.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  matrix,
  profiles,
  profileKey,
  stageProfiles,
  stageThemes,
  shiftCase,
  specimen,
  fixtureAssets,
  chromiumExecutable,
  routeFixture,
  openBoard,
  sourceSnapshot,
} from "./fixtures/local-stage-board.mjs";
import { runInteractions } from "./fixtures/local-stage-interactions.mjs";
import { runAmendmentTests } from "./fixtures/local-stage-amendment.mjs";
import { runGalleries } from "./fixtures/local-stage-galleries.mjs";
import { runNoticeChecks } from "./fixtures/local-stage-notice.mjs";
import { runCorrections } from "./fixtures/local-stage-corrections.mjs";
import {
  assertAttention,
  assertLayout,
  attentionReceipt,
  captureBoard,
  installBoardProbe,
  runRuntime,
} from "./fixtures/local-stage-runtime.mjs";

const evidence = process.env.ERA_STAGE_ART_EVIDENCE || ".pm/r123-evidence";
const phase =
  process.env.ERA_STAGE_PREVIEW === "1"
    ? "preview"
    : process.env.ERA_STAGE_PHASE || "all";
assert.ok(
  [
    "all",
    "preview",
    "scenes",
    "runtime",
    "interactions",
    "galleries",
    "amendment",
    "amendment-checks",
    "notice",
    "corrections",
  ].includes(phase),
);
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const executable = chromiumExecutable();
assert.ok(executable, "an installed Chromium browser is required");
const headed = process.env.ERA_STAGE_HEADED === "1";
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: !headed,
  executablePath: executable,
  args: ["--mute-audio"],
});
const errors = [],
  writes = [],
  captures = [],
  checks = [],
  layouts = [],
  attention = [];
let page;
const record = (name) => captures.push(name);
async function check(name, work) {
  try {
    await work();
    checks.push({ name, status: "passed" });
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      message: error.message,
      stack: error.stack,
    });
    process.stderr.write(name + ": " + error.message + "\n");
  }
}
function watch(value) {
  value.on("pageerror", (error) => errors.push(error.message));
}
async function scene(context, profile, theme, source) {
  const current = await context.newPage();
  watch(current);
  const state = await routeFixture(
    context,
    assets,
    writes,
    shiftCase(source.name),
  );
  await openBoard(
    current,
    state,
    assets,
    shiftCase(source.name),
    theme,
    source.seen,
  );
  const name = "board-" + profileKey(profile) + "-" + theme + "-" + source.name;
  await check(name, async () => {
    const layout = await captureBoard(current, evidence, name, record);
    layouts.push(layout);
    const rendered = await attentionReceipt(current);
    attention.push({ name, expected: source.expected, rendered });
    assertLayout(layout);
    assertAttention(rendered, source.expected);
    if (source.name === "interrupted-last-zone") {
      assert.equal(await current.locator(".board-camera").getAttribute("data-camera-mode"), "overview",
        "initial unavailable visit receives one fitted Overview");
      for (const zone of layout.zones)
        assert.ok(zone.box.x >= layout.board.x && zone.box.right <= layout.board.right + 1 &&
          zone.box.y >= layout.board.y && zone.box.bottom <= layout.board.bottom + 1,
          `${zone.id} initial unavailable pad stays inside the board at every size`);
    }
    assert.equal(await current.locator(".board-title h1").count(), 1);
    assert.equal(
      await current.locator(".foundry-mission,.foundry-terminal").count(),
      0,
    );
  });
  await current.close();
}
try {
  if (["all", "corrections"].includes(phase))
    await runCorrections(browser, assets, evidence, record, check, writes, errors);
  if (["all", "preview", "scenes", "amendment"].includes(phase)) {
    for (const profile of phase === "scenes" && !process.env.ERA_STAGE_WIDTHS ? profiles.slice(0, 1) : stageProfiles())
      for (const theme of phase === "scenes" && !process.env.ERA_STAGE_THEMES ? ["blue"] : stageThemes()) {
        const names =
          process.env.ERA_STAGE_CASES?.split(",") ?? (
          ["all", "scenes"].includes(phase) &&
          profile.width === 1494 &&
          theme === "blue"
            ? matrix.localCases.map((value) => value.name)
            : [
                "summary-and-changes",
                "failed-hook",
                "uat-required-review",
                ...(["all", "scenes"].includes(phase)
                  ? ["stale-last-zone", "interrupted-last-zone"]
                  : []),
              ]);
        for (const name of names) {
          const context = await browser.newContext({
            viewport: { width: profile.width, height: profile.height },
            deviceScaleFactor: profile.dpr,
            serviceWorkers: "block",
          });
          await scene(
            context,
            profile,
            theme,
            matrix.localCases.find((value) => value.name === name),
          );
          await context.close();
        }
      }
  }
  if (["all", "galleries"].includes(phase))
    await runGalleries(browser, assets, evidence, record, check);
  if (["all", "notice"].includes(phase))
    await runNoticeChecks(browser, assets, evidence, writes, record, check);
  if (
    [
      "all",
      "runtime",
      "interactions",
      "amendment",
      "amendment-checks",
      "notice",
    ].includes(phase)
  ) {
    const context = await browser.newContext({
      viewport: { width: 1494, height: 934 },
      deviceScaleFactor: 1.5,
      serviceWorkers: "block",
    });
    await context.addInitScript(installBoardProbe);
    const state = await routeFixture(context, assets, writes, specimen());
    page = await context.newPage();
    watch(page);
    if (!["interactions", "amendment-checks", "notice"].includes(phase))
      await runRuntime(page, state, assets, evidence, record, check);
    if (!["amendment-checks", "notice"].includes(phase))
      await runInteractions(page, state, assets, evidence, record, check);
    if (["all", "amendment", "amendment-checks", "notice"].includes(phase))
      await runAmendmentTests(page, state, assets, evidence, record, check);
    await context.close();
  }
} catch (error) {
  checks.push({
    name: `${phase} fatal setup/scene failure`,
    status: "failed",
    message: error.message,
    stack: error.stack,
  });
} finally {
  const finalSourceFacts = sourceSnapshot();
  const changedSources = [
    ...new Set([
      ...Object.keys(assets.sourceFacts),
      ...Object.keys(finalSourceFacts),
    ]),
  ].filter(
    (path) =>
      assets.sourceFacts[path]?.sha256 !== finalSourceFacts[path]?.sha256,
  );
  checks.push({
    name: "application sources remain bound to the served bundle",
    status: changedSources.length ? "failed" : "passed",
    changedSources,
  });
  const failures = checks.filter((check) => check.status === "failed");
  const receipt = {
    status:
      failures.length || errors.length || writes.length
        ? "failed"
        : phase === "all"
          ? "machine checks passed; real specimen FPS remains owner UAT"
          : phase === "notice"
            ? "passed"
            : "focused " + phase + " checks; not full acceptance",
    phase,
    selection: {
      widths: process.env.ERA_STAGE_WIDTHS?.split(",").map(Number) ?? null,
      themes: process.env.ERA_STAGE_THEMES?.split(",") ?? null,
      cases: process.env.ERA_STAGE_CASES?.split(",") ?? null,
    },
    scope:
      phase === "notice"
        ? "Final source-bound wrapper error, camera, and pulse amendment; prior complete art/runtime/legacy receipts remain linked in closeout."
        : phase,
    fixture: assets.fixture,
    executable,
    headed,
    browser: browser.version(),
    bundleFacts: assets.bundleFacts,
    sourceFacts: assets.sourceFacts,
    finalSourceFacts,
    captures,
    checks,
    layouts,
    attention,
    errors,
    writes,
    limits: {
      ownerFps:
        "Owner must open the actual specimen, press Shift+P, play Full and read >=55 FPS. A fixture pass does not prove that acceptance.",
      timing:
        "Whole stage RAF callback with test-only native-call counter overhead; unrelated task scripting is outside this measurement.",
      visibility:
        "Controlled document.visibilityState/hidden and visibilitychange contract was verified. Native automated Chrome remained visible after tab cover/window minimization; actual browser hiding remains owner UAT (native-visibility-probe.json).",
    },
  };
  writeFileSync(
    `${evidence}/${phase === "all" ? "result" : phase + "-result"}.json`,
    JSON.stringify(receipt, null, 2),
  );
  await browser.close();
  assert.equal(
    failures.length,
    0,
    failures.map((value) => value.name + ": " + value.message).join("\n"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
}
process.stdout.write(
  `R123 ${phase}: ${checks.length} checks, ${captures.length} captures\n`,
);
