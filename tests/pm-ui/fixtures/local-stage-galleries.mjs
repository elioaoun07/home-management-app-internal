import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { build } from "esbuild";
import { matrix, profileKey, sha256, specimen } from "./local-stage-board.mjs";
import { runBlindGallery } from "./local-stage-blind.mjs";

export async function galleryBundle() {
  const result = await build({
    entryPoints: ["tests/pm-ui/fixtures/local-stage-gallery.tsx"],
    bundle: true,
    write: false,
    outdir: ".pm/r123-test-gallery",
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    logLevel: "error",
  });
  return result.outputFiles.find((file) => file.path.endsWith(".js")).text;
}
export async function runGalleries(browser, assets, evidence, record, check) {
  const code = await galleryBundle();
  const bundle = { sha256: sha256(code), bytes: Buffer.byteLength(code) };
  writeFileSync(`${evidence}/test-gallery.js`, code);
  const ids = [
    "brief",
    "setup",
    "explore",
    "think",
    "build",
    "bench",
    "seal",
    "verify",
    "handover",
    "test",
    "ship",
  ];
  const facts = [],
    futures = [];
  for (const profile of [
    { width: 1494, height: 934, dpr: 1.5 },
    { width: 2560, height: 1271, dpr: 1 },
    { width: 2560, height: 1440, dpr: 2 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addStyleTag({ content: assets.bundle.css });
    await page.addScriptTag({ content: code });
    for (const theme of ["blue", "pink"]) {
      for (const id of ids)
        await check(`gallery ${profileKey(profile)} ${theme} ${id}`, async () => {
          const result = await page.evaluate(
            (request) => window.__artGallery.renderGallery(request),
            { run: specimen(), theme, mode: "zone", id },
          );
          facts.push({ profile, theme, ...result });
          const name = `zone-${profileKey(profile)}-${theme}-${id}`;
          await page
            .locator("#art-gallery")
            .screenshot({ path: `${evidence}/${name}.png` });
          record(name);
          assert.equal(result.strokes, 0, "solid machine bake must use fills");
          if (id === "think")
            assert.ok(result.orb?.visibleRatio >= 0.65,
              `Think group-colour orb is visible: ${result.orb?.pixels} native pixels / ${result.orb?.projectedArea.toFixed(2)} circle area`);
          for (const face of ["top", "left", "right"])
            assert.ok(result.exact[face] >= 5, `visible ${face} hull tone`);
          assert.ok(
            new Set(Object.values(result.tones)).size === 3,
            "three different material tones",
          );
          assert.ok(
            result.shadow > 5,
            "each machine casts an actual translucent shadow",
          );
          assert.ok(
            result.bounds.x > 0 &&
              result.bounds.y > 0 &&
              result.bounds.right < result.width - 1 &&
              result.bounds.bottom < result.height - 1,
            "isolated art is not clipped",
          );
          for (const sprite of [result.part, ...(result.bodyVariants ?? []), ...(result.partVariants ?? [])].filter(Boolean))
            assert.ok(
              sprite.bounds.x > 0 &&
                sprite.bounds.y > 0 &&
                sprite.bounds.right < sprite.width - 1 &&
                sprite.bounds.bottom < sprite.height - 1,
              "actual cached reached/off body and neutral/factual part sprites are not clipped",
            );
          assert.ok(
            result.bakeMs <= 150,
            "bake <=150ms (pixel readback excluded)",
          );
        });
      for (const mode of ["board", "era", "build"])
        await check(`gallery ${profileKey(profile)} ${theme} ${mode}`, async () => {
          const result = await page.evaluate(
            (request) => window.__artGallery.renderGallery(request),
            { run: specimen(), theme, mode },
          );
          facts.push({ profile, theme, ...result });
          const name = `art-${profileKey(profile)}-${theme}-${mode}`;
          await page
            .locator("#art-gallery")
            .screenshot({ path: `${evidence}/${name}.png` });
          record(name);
          assert.ok(result.ink > 100, "art has actual painted pixels");
          if (mode === "era") {
            assert.equal(result.width, Math.round(176 * Math.min(profile.dpr, 2)));
            assert.equal(result.height, Math.round(192 * Math.min(profile.dpr, 2)));
            for (const face of ["top", "left", "right"])
              assert.ok(result.exact[face] >= 5, `ERA has visible saturated ${face} shell tone`);
          }
          assert.equal(result.strokes, 0);
          assert.ok(result.bakeMs <= 150);
          assert.ok(
            result.bounds.x > 0 &&
              result.bounds.y > 0 &&
              result.bounds.right < result.width - 1 &&
              result.bounds.bottom < result.height - 1,
            "composed art is not clipped by its native buffer",
          );
        });
      if (profile.width === 1494)
        for (const source of matrix.futureCases)
          await check(`future ${theme} ${source.name}`, async () => {
            const items = await page.evaluate(
              ({ source, theme }) =>
                window.__artGallery.renderFutureRail(source, theme),
              { source: source.futureSource, theme },
            );
            await page.locator(".board-attention-card").first().waitFor();
            const rendered = await page
              .locator(".board-attention-card")
              .evaluateAll((nodes) =>
                nodes.map((node) => ({
                  id: node.dataset.attentionId,
                  kind: node.dataset.kind,
                  blocking: node.dataset.blocking,
                  title: node.querySelector("h3")?.textContent,
                })),
              );
            futures.push({ name: source.name, theme, items, rendered });
            const name = `future-${theme}-${source.name}`;
            await page
              .locator("#art-gallery")
              .screenshot({ path: `${evidence}/${name}.png` });
            record(name);
            assert.equal(rendered.length, source.expected.actCount);
            if (source.expected.order)
              assert.deepEqual(
                rendered.map((item) => item.id.split(":").slice(1).join(":")),
                source.expected.order,
              );
            if (source.expected.choices)
              for (const choice of source.expected.choices)
                assert.ok(
                  await page
                    .locator(".board-question-choices")
                    .getByText(choice, { exact: true })
                    .count(),
                );
            assert.ok(!items.some((item) => item.id.endsWith(":answered")));
          });
    }
    await context.close();
  }
  const blind = process.env.ERA_STAGE_BLIND === "0"
    ? null
    : await runBlindGallery(browser, assets, code, evidence, record);
  writeFileSync(
    `${evidence}/gallery.json`,
    JSON.stringify(
      {
        bundle,
        status:
          "test-only pure bake gallery; all pixel readback is outside product",
        facts,
        futures,
        blind,
      },
      null,
      2,
    ),
  );
  return { facts, futures, blind };
}
