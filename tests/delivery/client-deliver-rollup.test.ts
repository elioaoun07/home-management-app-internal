import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const client = readFileSync(join(process.cwd(), "scripts", "pm", "client.js"), "utf8");
const rollup = client.slice(
  client.indexOf("function renderChecklistRollup()"),
  client.indexOf("function renderBugsRollup()"),
);

describe("checklist rollup Deliver shortcut", () => {
  it("keeps static mode free of delivery data and controls", () => {
    expect(rollup).toContain("if (!CAN_EDIT) {");
    expect(rollup).toContain("renderChecklistRollupContent();");
    expect(rollup).toContain("loadDeliverySessions()");
  });

  it("uses checkbox identity from fileTasks without counting skipped rows", () => {
    expect(rollup).toContain("var tasks = fileTasks(f);");
    expect(rollup).toContain('c.state === "skipped" ? null : tasks[checkboxIndex++]');
    expect(rollup).toContain('data-deliver-file="');
    expect(rollup).toContain('data-deliver-cbidx="');
    expect(rollup).toContain("CAN_EDIT && task && task.postponed");
  });

  it("only exposes the shared shortcut for open, non-active delivery tasks", () => {
    expect(rollup).toContain('task.state === "open"');
    expect(rollup).toContain("!active");
    expect(rollup).toContain("deliveryActiveSessionFor(task.file.relPath, task.cbidx)");
    expect(rollup).toContain("deliveryTopics().indexOf(task.file.module) !== -1");
    expect(rollup).toContain('<span class="chip chip-pp">postponed</span>');
    expect(rollup).toContain("wireTaskActions();");
  });
});
