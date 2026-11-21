import assert from "node:assert/strict";
import { openBoard, shiftCase } from "./local-stage-board.mjs";
import {
  assertLayout,
  boardLayout,
  captureBoard,
} from "./local-stage-runtime.mjs";

export async function runInteractions(
  page,
  state,
  assets,
  evidence,
  record,
  check,
) {
  await check(
    "settings portal / keyboard rail / exact eleven labels",
    async () => {
      await openBoard(
        page,
        state,
        assets,
        shiftCase("uat-required-review"),
        "blue",
      );
      const gear = page
        .locator(".board-topbar")
        .getByRole("button", { name: "Settings", exact: true });
      await gear.click();
      const dialog = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await dialog.waitFor();
      assert.equal(
        await dialog.evaluate((node) => node.parentElement === document.body),
        true,
      );
      const color = await dialog.evaluate(
        (node) => getComputedStyle(node).backgroundColor,
      );
      assert.match(color, /rgb/u);
      assert.ok(!color.endsWith(", 0)"), "opaque floating panel");
      assert.equal(
        await dialog
          .getByRole("button", { name: "Sound", exact: true })
          .getAttribute("aria-pressed"),
        "false",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await gear.evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("n");
      assert.equal(
        await page.locator(".board-rail").getAttribute("data-open"),
        "true",
      );
      const labels = await page.locator(".board-zone-name").allTextContents();
      assert.deepEqual(
        labels.map((value) => value.trim()),
        [
          "01 BRIEF",
          "02 SETUP",
          "03 EXPLORE",
          "04 THINK",
          "05 BUILD",
          "06 BENCH",
          "07 SEAL",
          "08 VERIFY",
          "09 HANDOVER",
          "10 TEST",
          "11 SHIP",
        ],
      );
      assertLayout(await boardLayout(page));
    },
  );
  await check(
    "SQL local Done acknowledgement can be undone without a command",
    async () => {
      await openBoard(page, state, assets, shiftCase("sql-four-files"), "pink");
      const root = page.locator(".board-workshop");
      assert.equal(await root.getAttribute("data-attention"), "4");
      const first = page
        .locator('.board-attention-card[data-kind="sql"]')
        .first();
      const id = await first.getAttribute("data-attention-id");
      await first.getByRole("button", { name: "Done", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector(".board-workshop")?.dataset.attention === "3",
      );
      const done = page.locator(".board-attention-done");
      await done.locator("summary").click();
      const item = done.locator('[data-attention-id="' + id + '"]');
      assert.equal(await item.getAttribute("data-state"), "done");
      await item.getByRole("button", { name: "Done", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector(".board-workshop")?.dataset.attention === "4",
      );
    },
  );
  await check(
    "390px keyboard reaches the board and reserved rail",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openBoard(
        page,
        state,
        assets,
        shiftCase("uat-required-review"),
        "pink",
      );
      const first = page.getByRole("button", {
        name: "Open brief",
        exact: true,
      });
      await first.focus();
      assert.equal(
        await first.evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("n");
      assert.equal(
        await page
          .locator(".board-rail")
          .evaluate((node) => node === document.activeElement),
        true,
      );
      assertLayout(await boardLayout(page));
      await captureBoard(page, evidence, "keyboard-390-pink", record);
      await page.setViewportSize({ width: 1494, height: 934 });
    },
  );
}
