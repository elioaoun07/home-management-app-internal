import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { openBoard, shiftCase } from "./local-stage-board.mjs";
import {
  assertLayout,
  boardLayout,
  captureBoard,
} from "./local-stage-runtime.mjs";

export async function runAmendmentTests(
  page,
  state,
  assets,
  evidence,
  record,
  check,
) {
  const facts = {};
  await check(
    "wheel and pan / body plain0 / modifier-input guards / unavailable freeze",
    async () => {
      const run = shiftCase("brief-look");
      run.activity[0].at = new Date(Date.now() - 1000).toISOString();
      await openBoard(page, state, assets, run, "pink");
      const camera = page.locator(".board-camera"),
        board = page.locator(".board-region");
      const mission = !!await page.locator(".board-dock").count();
      const pose = () => mission
        ? camera.evaluate((node) => getComputedStyle(node).transform)
        : camera.getAttribute("style");
      const settle = () => page.waitForTimeout(mission ? 1050 : 150);
      await settle();
      const baseline = await pose(),
        box = await board.boundingBox();
      await page.mouse.move(box.x + 45, box.y + 45);
      await page.mouse.wheel(0, -150);
      await settle();
      const zoomed = await pose();
      assert.notEqual(zoomed, baseline, "the actual wheel path zooms");
      await page.evaluate(
        () =>
          document.activeElement instanceof HTMLElement &&
          document.activeElement.blur(),
      );
      assert.equal(
        await page.evaluate(() => document.activeElement === document.body),
        true,
      );
      await page.keyboard.press("0");
      await settle();
      assert.equal(
        await pose(),
        baseline,
        "plain0 from body restores fit after wheel",
      );
      await page.mouse.move(box.x + 45, box.y + 45);
      await page.mouse.down();
      await page.mouse.move(box.x + 85, box.y + 70);
      await page.mouse.up();
      await settle();
      const panned = await pose();
      assert.notEqual(panned, baseline, "the actual drag path pans");
      await page.keyboard.press("0");
      await settle();
      assert.equal(
        await pose(),
        baseline,
        "plain0 restores fit after pan",
      );
      await page.mouse.wheel(0, -150);
      await settle();
      const guardedZoom = await pose();
      const guards = await page.evaluate(() => {
        const modified = new KeyboardEvent("keydown", {
          key: "0",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(modified);
        const input = document.createElement("input");
        input.type = "text";
        document.body.appendChild(input);
        input.focus();
        const typed = new KeyboardEvent("keydown", {
          key: "0",
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(typed);
        input.remove();
        const editable = document.createElement("div");
        editable.contentEditable = "true";
        document.body.appendChild(editable);
        editable.focus();
        const edit = new KeyboardEvent("keydown", {
          key: "0",
          bubbles: true,
          cancelable: true,
        });
        editable.dispatchEvent(edit);
        editable.remove();
        return {
          modified: modified.defaultPrevented,
          input: typed.defaultPrevented,
          editable: edit.defaultPrevented,
        };
      });
      assert.deepEqual(guards, {
        modified: false,
        input: false,
        editable: false,
      });
      assert.equal(
        await pose(),
        guardedZoom,
        "guarded zero keys do not move the camera",
      );
      state.run = { ...run, interrupted: true };
      await page.waitForFunction(
        () =>
          document.querySelector(".board-workshop")?.dataset.liveness ===
          "signal-lost",
      );
      await page.waitForTimeout(200);
      await page.keyboard.press("0");
      assert.equal(
        await pose(),
        guardedZoom,
        "signal-lost camera stays frozen",
      );
      state.failed = true;
      await page.waitForFunction(
        () =>
          document.querySelector(".board-workshop")?.dataset.liveness ===
          "link-down",
      );
      await page.waitForTimeout(200);
      await page.keyboard.press("0");
      assert.equal(
        await pose(),
        guardedZoom,
        "link-down camera stays frozen",
      );
      facts.camera = {
        baseline,
        zoomed,
        panned,
        guardedZoom,
        guards,
        signalLost: "unchanged",
        linkDown: "unchanged",
        previousFailure:
          "../final-art/result.json: board-2560-pink-uat-required-review was captured at manual zoom1.1589",
      };
    },
  );
  for (const theme of ["blue", "pink"])
    await check(
      `active dot pulse / hidden-linkdown-reduced pause ${theme}`,
      async () => {
        const run = shiftCase("brief-look");
        run.phase = "preparing";
        run.activity = [
          {
            at: new Date().toISOString(),
            kind: "status",
            summary: "Installing dependencies",
            seq: 0,
            job_id: "supervisor",
          },
        ];
        await openBoard(page, state, assets, run, theme);
        const dot = page
          .locator('.board-zone-group [data-state="active"]')
          .first();
        await dot.waitFor();
        const before = await dot.evaluate((node) => ({
          name: getComputedStyle(node).animationName,
          opacity: getComputedStyle(node).opacity,
        }));
        await page.waitForTimeout(600);
        const after = await dot.evaluate(
          (node) => getComputedStyle(node).opacity,
        );
        assert.equal(before.name, "board-dot");
        assert.notEqual(before.opacity, after, "active dot visibly pulses");
        await captureBoard(page, evidence, `pulse-${theme}`, record);
        // Native automated Chrome stayed visible after tab/window minimization.
        // This deterministic test supplies the two visibility inputs and event;
        // owner UAT covers actual browser visibility. Restore exact descriptors.
        const descriptors = await page.evaluate(() => {
          window.__boardVisibilityDescriptors = {
            state: Object.getOwnPropertyDescriptor(document, "visibilityState"),
            hidden: Object.getOwnPropertyDescriptor(document, "hidden"),
          };
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "hidden",
          });
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
          return {
            stateOwn: !!window.__boardVisibilityDescriptors.state,
            hiddenOwn: !!window.__boardVisibilityDescriptors.hidden,
          };
        });
        let hidden;
        try {
          await page.waitForFunction(
            () =>
              document.querySelector(".board-workshop")?.dataset.motion ===
              "paused",
            null,
            { polling: 100 },
          );
          hidden = await dot.evaluate(
            (node) => getComputedStyle(node).animationPlayState,
          );
          assert.equal(hidden, "paused");
        } finally {
          await page.evaluate(() => {
            const previous = window.__boardVisibilityDescriptors;
            if (previous.state)
              Object.defineProperty(
                document,
                "visibilityState",
                previous.state,
              );
            else delete document.visibilityState;
            if (previous.hidden)
              Object.defineProperty(document, "hidden", previous.hidden);
            else delete document.hidden;
            delete window.__boardVisibilityDescriptors;
            document.dispatchEvent(new Event("visibilitychange"));
          });
        }
        const restored = await page.evaluate(() => ({
          stateOwn: !!Object.getOwnPropertyDescriptor(
            document,
            "visibilityState",
          ),
          hiddenOwn: !!Object.getOwnPropertyDescriptor(document, "hidden"),
        }));
        assert.deepEqual(
          restored,
          descriptors,
          "exact visibility property ownership restored",
        );
        state.failed = true;
        await page.waitForFunction(
          () =>
            document.querySelector(".board-workshop")?.dataset.liveness ===
            "link-down",
        );
        await page.waitForFunction(
          () =>
            document.querySelector(".board-workshop")?.dataset.motion ===
            "paused",
        );
        const paused = await dot.evaluate((node) => ({
          state: getComputedStyle(node).animationPlayState,
          opacity: getComputedStyle(node).opacity,
        }));
        await page.waitForTimeout(400);
        assert.equal(paused.state, "paused");
        assert.equal(
          await dot.evaluate((node) => getComputedStyle(node).opacity),
          paused.opacity,
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        assert.equal(
          await dot.evaluate((node) => getComputedStyle(node).animationName),
          "none",
        );
        facts[theme] = {
          before,
          after,
          hidden,
          visibilityMode:
            "Controlled document inputs/event; native automated Chrome tabs/minimized window remained visible. Owner UAT covers actual hiding.",
          descriptorsRestored: restored,
          linkDown: paused,
          reduced: "none",
        };
        await page.emulateMedia({ reducedMotion: "no-preference" });
        facts[theme].layoutAfterLinkDown = await boardLayout(page);
        await captureBoard(page, evidence, `linkdown-${theme}`, record);
        assertLayout(facts[theme].layoutAfterLinkDown);
      },
    );
  writeFileSync(
    `${evidence}/amendment.json`,
    JSON.stringify(
      { status: "bounded final CSS/keyboard/readout amendment", facts },
      null,
      2,
    ),
  );
  return facts;
}
