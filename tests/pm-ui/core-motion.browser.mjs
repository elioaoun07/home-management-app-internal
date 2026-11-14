// Credential-free A5 fixture only. Read responses below are synthetic and every
// non-loopback request is blocked. No provider/session/data write is exercised.
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
  viewport: { width: 1440, height: 960 },
  serviceWorkers: "block",
  reducedMotion: "no-preference",
});
await context.addInitScript(() => localStorage.setItem("pm-game-layer", "on"));
const page = await context.newPage();
const evidence = process.env.ERA_CORE_EVIDENCE || ".pm/r105-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [],
  writes = [],
  observations = [],
  screenshots = [],
  dynamics = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
    writes.push(`${request.method()} ${request.url()}`);
});
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
let scenario = "idle";
let navigation = 0;
const queue = {
  running: [],
  waiting: [],
  decisions: [],
  candidates: [],
  applying: null,
};
const at = new Date().toISOString();
const runs = () => {
  const common = {
    run_id: "core-browser",
    alias: "BUD-9",
    title: "Synthetic session",
    ownerActionKind: "none",
    ownerAction: "",
    active: false,
    updated_at: at,
    application: null,
  };
  if (scenario === "running")
    return [
      {
        ...common,
        lifecycle: "ACTIVE",
        active: true,
        ownerAction: "Implementing",
      },
    ];
  if (scenario === "attention")
    return [
      {
        ...common,
        lifecycle: "REVIEW",
        ownerActionKind: "plan-approval",
        ownerAction: "Approve plan",
      },
    ];
  if (scenario === "success")
    return [
      { ...common, lifecycle: "CLOSED", closed_outcome: "verified_candidate" },
    ];
  if (scenario === "failed")
    return [{ ...common, lifecycle: "CLOSED", closed_outcome: "failed" }];
  return [];
};
const json = (route, value, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (url.pathname === "/api/data") {
    const response = await route.fetch();
    const data = await response.json();
    data.files = data.files.filter((file) => file.relPath !== "_Decisions.md");
    data.files.push({
      relPath: "_Decisions.md",
      raw: "# Decisions\n\n## Open choices\n\n| DEC-999 | Synthetic standing PM choice | Owner review | Browser fixture |\n",
    });
    return route.fulfill({ response, json: data });
  }
  if (url.pathname === "/api/delivery/v2/session")
    return json(route, { paired: true, actor: "fixture", csrf: "fixture" });
  if (url.pathname === "/api/delivery/sessions")
    return json(route, { sessions: [] });
  if (url.pathname === "/api/delivery/v2/runs")
    return json(route, { runs: runs(), requests: [] });
  if (url.pathname === "/api/delivery/v2/queue")
    return scenario === "unknown"
      ? json(route, { error: "Synthetic unavailable source" }, 503)
      : json(route, { queue });
  if (url.pathname === "/api/delivery/v2/uat")
    return json(route, { handovers: [] });
  return route.continue();
});

const core = () => page.locator(".bridge-core");
const throttle = () =>
  page.getByRole("button", { name: "Throttle ERA", exact: true });
const waitState = (state) =>
  page.waitForFunction(
    (expected) =>
      document.querySelector(".bridge-core")?.dataset.state === expected,
    state,
  );
const animations = () =>
  core().evaluate((element) =>
    element.getAnimations({ subtree: true }).map((animation) => ({
      name: animation.animationName || "web-animation",
      state: animation.playState,
      time: animation.currentTime,
      duration: animation.effect?.getTiming().duration,
      iterations:
        animation.effect?.getTiming().iterations === Infinity
          ? "infinite"
          : animation.effect?.getTiming().iterations,
    })),
  );
const motion = () =>
  core().evaluate((element) => ({
    rpm: Number(element.dataset.rpm),
    energy: Number(element.dataset.energy),
    throttle: element.dataset.throttle,
    state: element.dataset.state,
    phase: element.dataset.phase,
    angle: Number(element.dataset.angle),
    particles: Number(element.dataset.particles),
    hue:
      ((Number(
        getComputedStyle(
          element.querySelector(".core-hub .era-mark"),
        ).getPropertyValue("--hue"),
      ) %
        360) +
        360) %
      360,
    motion: element.dataset.motion,
    rotor: element.querySelector(".core-rotor").style.transform,
    wheel: element.querySelector(".core-wheel").style.transform,
    text: element.querySelector(".bridge-core-caption").innerText,
  }));
const sample = async (label) => {
  const value = await motion();
  assert.ok(Number.isFinite(value.rpm), `${label}: finite measured speed`);
  assert.ok(Number.isFinite(value.energy), `${label}: finite measured energy`);
  if (value.state === "idle" && value.energy > 0) {
    assert.ok(
      value.hue < 70 || value.hue > 170,
      `${label}: idle throttle never passes through success green`,
    );
    if (value.energy > 0.98)
      assert.ok(
        value.hue < 20 || value.hue > 350,
        `${label}: full throttle has a red hub`,
      );
  }
  dynamics.push({ label, ...value });
  return value;
};
const assertFrozen = async (label) => {
  const before = await motion();
  await page.waitForTimeout(250);
  const after = await motion();
  assert.equal(after.rotor, before.rotor, `${label}: inertia loop is paused`);
  assert.equal(after.wheel, before.wheel, `${label}: vibration is paused`);
  assert.ok(
    (await animations()).every((animation) => animation.state !== "running"),
    `${label}: decorative animations are paused`,
  );
};
const capture = async (name) => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name}: horizontal overflow`,
  );
  await page.screenshot({
    path: `${evidence}/${name}.png`,
    animations: "allow",
  });
  screenshots.push(name);
};
const open = async (state, theme = "blue") => {
  scenario = state;
  const target = new URL(base);
  target.searchParams.set("core-scene", String(++navigation));
  target.hash = "/bridge";
  await page.goto(target.toString());
  await waitState(state);
  await throttle().waitFor();
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await page.getByRole("button", { name: `Use ${theme} theme` }).click();
  await page.waitForTimeout(state === "running" ? 1100 : 350);
};

try {
  if (process.env.ERA_CORE_HUE_ONLY) {
    const paths = [];
    for (const [width, theme] of [
      [1440, "blue"],
      [390, "pink"],
    ]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
      await open("idle", theme);
      await page.evaluate(() => {
        window.__coreHueSamples = [];
        window.__coreHueDone = false;
        const start = performance.now();
        const collect = () => {
          const core = document.querySelector(".bridge-core");
          const hue = Number(
            getComputedStyle(
              core.querySelector(".core-hub .era-mark"),
            ).getPropertyValue("--hue"),
          );
          window.__coreHueSamples.push({
            elapsed: performance.now() - start,
            hue: ((hue % 360) + 360) % 360,
            energy: Number(core.dataset.energy),
            rpm: Number(core.dataset.rpm),
          });
          if (performance.now() - start < 9000) requestAnimationFrame(collect);
          else window.__coreHueDone = true;
        };
        collect();
      });
      await throttle().click();
      if (width === 1440) {
        const frames = [];
        const started = Date.now();
        for (let i = 0; i < 25; i++) {
          const file = `hue-frame-${String(i).padStart(2, "0")}.png`;
          writeFileSync(
            `${evidence}/${file}`,
            await core().screenshot({ animations: "allow" }),
          );
          frames.push({
            file,
            elapsed: Date.now() - started,
            ...(await sample(`hue-frame-${i}`)),
          });
          await page.waitForTimeout(225);
        }
        writeFileSync(
          `${evidence}/hue-frames.json`,
          JSON.stringify(frames, null, 2),
        );
        writeFileSync(
          `${evidence}/hue-replay.html`,
          `<!doctype html><meta charset="utf-8"><title>ERA final hue sequence</title><style>body{background:#101723;color:#e4eaf4;font:16px system-ui;text-align:center}img{max-height:75vh}button{font:inherit;padding:10px}</style><h1>ERA overload - final color path</h1><img id="frame"><p id="stats"></p><button id="play">Replay</button><script>const frames=${JSON.stringify(frames)};let timer;function play(){clearTimeout(timer);let i=0;const start=performance.now();function tick(){while(i<frames.length-1&&frames[i+1].elapsed-frames[0].elapsed<performance.now()-start)i++;const f=frames[i];document.querySelector('#frame').src=f.file;document.querySelector('#stats').textContent=(f.elapsed/1000).toFixed(2)+'s | '+f.rpm.toFixed(1)+' rpm | hue '+f.hue.toFixed(1);if(i<frames.length-1)timer=setTimeout(tick,30)}tick()}document.querySelector('#play').onclick=play;play();</script>`,
        );
      } else {
        await page.waitForTimeout(850);
        await sample("hue-mobile-peak");
        await capture("hue-throttle-peak-390-pink");
      }
      await page.waitForFunction(() => window.__coreHueDone);
      const samples = await page.evaluate(() => window.__coreHueSamples);
      assert.ok(
        samples.length > 150,
        "Sample the live hue path across acceleration and cooldown",
      );
      assert.ok(
        samples
          .filter((s) => s.energy > 0)
          .every((s) => s.hue < 70 || s.hue > 170),
        "Heating and cooling never cross success green",
      );
      const peak = samples.reduce((a, b) => (a.energy > b.energy ? a : b));
      assert.ok(
        peak.energy > 0.98 && (peak.hue < 20 || peak.hue > 350),
        "Full throttle reaches a red hub",
      );
      assert.ok(
        samples.at(-1).energy < 0.01 &&
          samples.at(-1).hue > 200 &&
          samples.at(-1).hue < 210,
        "Cooldown returns to the blue idle hub",
      );
      paths.push({ width, theme, samples });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open("running");
    for (const [state, hue] of [
      ["running", 12],
      ["attention", 43],
      ["success", 155],
    ]) {
      scenario = state;
      await waitState(state);
      assert.equal(
        (await motion()).hue,
        hue,
        `Reduced motion uses the exact ${state} hue`,
      );
      await assertFrozen(`Reduced motion ${state}`);
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(writes.length, 0, writes.join("\n"));
    writeFileSync(
      `${evidence}/hue-amendment.json`,
      JSON.stringify(
        {
          ok: true,
          synthetic: true,
          paths,
          dynamics,
          screenshots,
          errors,
          writes,
          reducedMotionStateColors: true,
        },
        null,
        2,
      ),
    );
    process.stdout.write("ERA shortest-path hue amendment passed.\n");
  } else {
    for (const width of process.env.ERA_CORE_FAST ? [] : [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
      for (const theme of ["blue", "pink"]) {
        for (const state of [
          "idle",
          "running",
          "attention",
          "success",
          "failed",
          "unknown",
        ]) {
          await open(state, theme);
          const before = await animations();
          if (["idle", "running", "attention"].includes(state)) {
            assert.ok(
              before.some(
                (animation) =>
                  animation.iterations === "infinite" &&
                  animation.state === "running",
              ),
              `${state}: continuous motion`,
            );
            await page.waitForTimeout(220);
            const after = await animations();
            assert.ok(
              after.some(
                (animation, index) => animation.time !== before[index]?.time,
              ),
              `${state}: advancing motion`,
            );
          }
          const target = await throttle().boundingBox();
          assert.ok(
            target.width >= 40 && target.height >= 40,
            "Core has a touch-sized button",
          );
          assert.equal(
            await core()
              .getByRole("link", { name: "Open sessions", exact: true })
              .getAttribute("href"),
            "#/sessions?view=delivery",
          );
          const properties = await core().evaluate((element) => ({
            state: element.dataset.state,
            color: getComputedStyle(element).getPropertyValue("--core-color"),
            ringColor: getComputedStyle(
              element.querySelector(".core-wheel-lines"),
            ).color,
            rpm: Number(element.dataset.rpm),
            energy: Number(element.dataset.energy),
            splitRing: getComputedStyle(
              element.querySelector(".core-split-ring"),
            ).display,
            particles: Number(element.dataset.particles),
            text: element.innerText,
          }));
          if (state === "running") {
            assert.equal(properties.color.trim(), "#ff6546");
            assert.ok(
              properties.energy > 0.45,
              "Running has sustained friction energy",
            );
            assert.ok(
              properties.rpm > 100,
              "Running spins at sustained high speed",
            );
          }
          if (state === "attention") {
            assert.equal(properties.color.trim(), "#f5c451");
            assert.equal(properties.particles, 0);
            assert.equal(properties.energy, 0);
            assert.ok(
              properties.rpm > 0 && properties.rpm < 4,
              "Waiting rotates slowly",
            );
          }
          if (state === "success")
            assert.equal(properties.color.trim(), "#53dba0");
          if (state === "failed") {
            assert.notEqual(properties.splitRing, "none");
            assert.equal(
              properties.color.trim(),
              "#94a3b8",
              "Failure ring stays grey in either theme",
            );
          }
          observations.push({
            width,
            theme,
            ...properties,
            animations: before,
          });
          await capture(`${state}-${width}-${theme}`);
        }
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await open("idle");
    const href = page.url();
    const initialWheel = await page.locator(".core-wheel").elementHandle();
    const initialText = (await motion()).text;
    await throttle().click();
    await page.waitForFunction(
      () => document.querySelector(".bridge-core")?.dataset.throttle === "true",
    );
    assert.equal(page.url(), href, "Throttle click does not navigate");
    assert.equal(
      await initialWheel.evaluate((node) => node.isConnected),
      true,
      "Click preserves wheel phase and element identity",
    );
    assert.equal(
      await core().getAttribute("data-state"),
      "idle",
      "Visual burst does not invent a running session",
    );
    await page.waitForTimeout(600);
    const peak = await sample("throttle-peak");
    assert.ok(
      peak.rpm > 180 && peak.energy > 0.6,
      "Throttle reaches overload speed and heat",
    );
    assert.equal(
      peak.text,
      initialText,
      "Throttle preserves the truthful caption",
    );
    assert.ok(
      peak.particles > 20,
      "Throttle emits a substantial particle field",
    );
    assert.ok(
      await page.locator("canvas.core-exhaust").count(),
      "Friction particles render in the bounded canvas",
    );
    await capture("throttle-peak-390");
    await page.waitForTimeout(700);
    const kickedWheel = await page.locator(".core-wheel").elementHandle();
    const beforeRepeat = await motion();
    await throttle().click();
    const afterRepeat = await sample("throttle-retrigger");
    assert.equal(
      await kickedWheel.evaluate((node) => node.isConnected),
      true,
      "Repeated activation preserves the physical wheel",
    );
    assert.ok(
      afterRepeat.rpm >= beforeRepeat.rpm * 0.95,
      "Repeated activation preserves existing momentum",
    );
    assert.ok(
      afterRepeat.angle >= beforeRepeat.angle,
      "Repeated activation preserves accumulated rotor angle",
    );
    assert.equal(
      await throttle().evaluate((button) => document.activeElement === button),
      true,
      "Retrigger preserves button focus",
    );
    await page.waitForTimeout(1600);
    assert.equal(
      await core().getAttribute("data-throttle"),
      "true",
      "Repeated activation extends the driven burst",
    );
    await page.waitForFunction(
      () => document.querySelector(".bridge-core")?.dataset.throttle !== "true",
      undefined,
      { timeout: 4000 },
    );
    const release = await sample("throttle-release");
    assert.ok(
      release.rpm > 80 && release.energy > 0.2,
      "Release retains momentum and heat instead of snapping off",
    );
    await capture("throttle-release-390");
    const coast = [release];
    for (const delay of [500, 750, 1000, 1500, 2000]) {
      await page.waitForTimeout(delay);
      coast.push(await sample(`cooldown-${coast.length}`));
    }
    for (let i = 1; i < coast.length; i++) {
      assert.ok(
        coast[i].rpm < coast[i - 1].rpm,
        `Cooldown ${i}: wheel progressively slows`,
      );
      assert.ok(
        coast[i].energy <= coast[i - 1].energy,
        `Cooldown ${i}: friction progressively fades`,
      );
    }
    assert.ok(
      coast[1].rpm > 20 && coast[2].rpm > 8,
      "Cooldown remains perceptible instead of stopping immediately",
    );
    assert.ok(
      coast.at(-1).rpm < 7 && coast.at(-1).energy < 0.04,
      "Cooldown returns to gentle idle",
    );
    await capture("throttle-settled-390");
    await throttle().focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.querySelector(".bridge-core")?.dataset.throttle === "true",
    );
    await page.waitForTimeout(350);
    assert.ok(
      (await motion()).rpm > 100,
      "Keyboard activation drives the same wheel",
    );

    // The same inertia persists during a real observed run, then coasts down
    // when the existing read-only poll reports completion (without remounting).
    await open("running");
    await page.waitForTimeout(3000);
    const running = await sample("running-sustained");
    assert.ok(
      running.rpm > 100 && running.energy > 0.5,
      "Running effects last beyond the manual throttle window",
    );
    const runningWheel = await page.locator(".core-wheel").elementHandle();
    scenario = "success";
    await waitState("success");
    const completed = await sample("running-completed");
    assert.equal(
      await runningWheel.evaluate((node) => node.isConnected),
      true,
      "Session completion preserves the rotating wheel",
    );
    assert.ok(completed.rpm > 40, "Completion begins with residual momentum");
    await page.waitForTimeout(1000);
    const completedCoast = await sample("running-completed-coast");
    assert.ok(
      completedCoast.rpm < completed.rpm && completedCoast.rpm > 5,
      "Session completion also slows gradually",
    );
    await open("running");
    scenario = "failed";
    await waitState("failed");
    const failed = await sample("running-failed");
    assert.ok(failed.rpm > 40, "Failed completion retains residual momentum");
    const failedRing = () =>
      page.locator(".core-split-ring").evaluate((element) => ({
        transform: element.style.transform,
        display: getComputedStyle(element).display,
      }));
    const ringBefore = await failedRing();
    assert.notEqual(
      ringBefore.display,
      "none",
      "Failed state immediately shows the split ring",
    );
    await page.waitForTimeout(900);
    const failedCoast = await sample("running-failed-coast");
    assert.ok(
      failedCoast.rpm < failed.rpm && failedCoast.rpm > 2,
      "Failed wheel loses momentum progressively",
    );
    assert.notEqual(
      (await failedRing()).transform,
      ringBefore.transform,
      "Visible split ring also coasts instead of snapping to a stop",
    );
    await capture("failed-coast-390");
    await open("running");
    await page.waitForTimeout(900);
    await page.locator(".bridge-charts").scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    writeFileSync(
      `${evidence}/pause-observation.json`,
      JSON.stringify(
        {
          animations: await animations(),
          core: await core().evaluate((element) => ({
            motion: element.dataset.motion,
            top: element.getBoundingClientRect().top,
            bottom: element.getBoundingClientRect().bottom,
            scroll: scrollY,
            bodyHeight: document.body.scrollHeight,
            innerHeight,
          })),
        },
        null,
        2,
      ),
    );
    await assertFrozen("Offscreen core");
    await throttle().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.ok(
      (await animations()).some((animation) => animation.state === "running"),
      "Visible core resumes",
    );

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    await assertFrozen("Hidden document");
    await page.evaluate(() => {
      delete document.hidden;
      delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    await throttle().click();
    assert.equal(
      (await animations()).filter((animation) => animation.state === "running")
        .length,
      0,
      "Reduced motion disables core motion and click effects",
    );
    await assertFrozen("Reduced motion");
    await capture("reduced-motion-running-390");
    for (const [state, hue] of [
      ["attention", 43],
      ["success", 155],
    ]) {
      scenario = state;
      await waitState(state);
      const actualHue = await page
        .locator(".core-hub .era-mark")
        .evaluate((element) =>
          Number(getComputedStyle(element).getPropertyValue("--hue")),
        );
      assert.equal(
        actualHue,
        hue,
        `Reduced motion follows ${state} status color`,
      );
      await assertFrozen(`Reduced motion ${state}`);
    }
    if (process.env.ERA_CORE_RECORD) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 1440, height: 960 });
      await open("idle");
      const frames = [];
      await throttle().click();
      const started = Date.now();
      for (let i = 0; i < 25; i++) {
        const frame = await core().screenshot({ animations: "allow" });
        const file = `burnout-frame-${String(i).padStart(2, "0")}.png`;
        writeFileSync(`${evidence}/${file}`, frame);
        frames.push({
          file,
          elapsed: Date.now() - started,
          ...(await motion()),
        });
        await page.waitForTimeout(225);
      }
      writeFileSync(
        `${evidence}/burnout-frames.json`,
        JSON.stringify(frames, null, 2),
      );
      const replay = `<!doctype html><meta charset="utf-8"><title>ERA burnout sequence</title>
<style>body{background:#101723;color:#e4eaf4;font:16px system-ui;display:grid;justify-content:center;text-align:center}img{max-height:70vh}button{font:inherit;padding:10px}p{font-variant-numeric:tabular-nums}</style>
<h1>ERA overload - recorded browser frames</h1><img id="frame"><p id="stats"></p><button id="play">Replay</button>
<script>const frames=${JSON.stringify(frames)};let timer;function replay(){clearTimeout(timer);let i=0;const start=performance.now();function tick(){while(i<frames.length-1&&frames[i+1].elapsed-frames[0].elapsed<performance.now()-start)i++;const f=frames[i];document.querySelector('#frame').src=f.file;document.querySelector('#stats').textContent=(f.elapsed/1000).toFixed(2)+'s | '+f.rpm.toFixed(1)+' rpm | heat '+f.energy.toFixed(2)+' | '+f.particles+' particles';if(i<frames.length-1)timer=setTimeout(tick,30)}tick()}document.querySelector('#play').onclick=replay;replay();</script>`;
      writeFileSync(`${evidence}/burnout-replay.html`, replay);
      observations.push({
        recordedFrames: frames.length,
        durationMs: frames.at(-1).elapsed,
      });
    }
    await page.getByRole("switch", { name: "Game layer", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".bridge")?.dataset.mode === "calm",
    );
    assert.equal(await core().count(), 0, "Calm mode removes animated core");
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(writes.length, 0, writes.join("\n"));
    writeFileSync(
      `${evidence}/browser-result.json`,
      JSON.stringify(
        {
          ok: true,
          synthetic: true,
          nativeSessions: 0,
          observations,
          dynamics,
          screenshots,
          errors,
          writes,
          throttle: true,
          continuousMomentum: true,
          progressiveCooldown: true,
          repeatedActivation: true,
          sessionCompletionCooldown: true,
          reducedMotion: true,
          offscreenPause: true,
          hiddenPause: true,
        },
        null,
        2,
      ),
    );
    process.stdout.write("Animated ERA core browser checks passed.\n");
  }
} catch (error) {
  await page.screenshot({
    path: `${evidence}/failure.png`,
    fullPage: true,
    animations: "allow",
  });
  writeFileSync(`${evidence}/failure.txt`, error.stack || String(error));
  throw error;
} finally {
  await browser.close();
}
