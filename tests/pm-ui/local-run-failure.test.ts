import { describe, expect, it } from "vitest";
import {
  localRunFailure,
  stripAnsi,
  type LocalFailureRecord,
} from "../../scripts/pm/app/localRunFailure";

const base = {
  phase: "failed",
  interrupted: false,
  branch: "delivery/HUB-118-cac958d7",
  activity: [] as { at: string; summary: string; kind?: string }[],
  checks: [] as { name: string; exit: number | null; error: string | null }[],
};

describe("Local failure black box", () => {
  it.each<[LocalFailureRecord["code"], string, string]>([
    ["install", "Setup", "Setup failed"],
    ["secrets", "Setup", "Setup failed"],
    ["native-error", "Build", "Agent ended early"],
    ["no-change", "Build", "No changes made"],
    ["commit-hook", "Seal", "Commit hook failed"],
    ["commit-timeout", "Seal", "Commit timed out"],
    ["checks", "Verify", "Check failed: test"],
    ["handover", "Handover", "Handover incomplete"],
    ["cancelled", "—", "Cancelled"],
  ])("prefers structured %s over the old log's title and excerpt", (code, step, title) => {
    const detail = code === "checks" ? "test\nAssertionError: specific cause" : "specific recorded cause";
    const failure = localRunFailure({ ...base, error: "native session did not confirm success", failure: { code, step, detail } });
    expect(failure).toMatchObject({ title, stage: step, excerpt: detail, log: "native session did not confirm success" });
  });
  it("decodes a structured failure even when no raw log is present", () => {
    expect(localRunFailure({ ...base, failure: { code: "native-error", step: "Build", detail: "sandbox unavailable" } })).toMatchObject({ title: "Agent ended early", excerpt: "sandbox unavailable", log: "" });
  });
  it("shows an explicit absence when a no-change worker reported no final text", () => {
    expect(localRunFailure({ ...base, failure: { code: "no-change", step: "Build", detail: "" } })).toMatchObject({ title: "No changes made", excerpt: "no reason reported" });
  });

  it.each([
    [
      "worktree dependencies unavailable; offline frozen install failed",
      "Setup",
      "launch",
      "Dependency setup failed",
    ],
    [
      "worktree contains a secret",
      "Setup",
      "launch",
      "Secret guard stopped it",
    ],
    ["native session exited 1", "Build", "forge", "Agent could not start"],
    [
      "native session did not confirm success",
      "Build",
      "forge",
      "Agent ended early",
    ],
    ["candidate needs a change", "Build", "forge", "No changes made"],
    [
      "git commit: hook log",
      "Build → Verify",
      "forge-lab",
      "Commit hook failed",
    ],
    ["git status: error", "Build → Verify", "forge-lab", "Git step failed"],
    ["git commit: timed out after 1 s", "Build → Verify", "forge-lab", "Commit timed out"],
    [
      "candidate changed during host checks",
      "Verify",
      "lab",
      "Candidate changed",
    ],
    ["handover incomplete", "Handover", "review", "Handover missing"],
    [
      "invalid .delivery-handover.json",
      "Handover",
      "review",
      "Handover missing",
    ],
  ])("decodes supervisor error %s", (error, stage, station, title) => {
    expect(localRunFailure({ ...base, error })).toMatchObject({
      stage,
      station,
      title,
    });
  });

  it("promotes the failure summary from the ANSI-stripped log tail and retains files", () => {
    const error = `git commit: Checking AI guidance docs...\n${"padding\n".repeat(20)}\n\u001b[31mTest Files  2 failed | 30 passed\u001b[0m\n${Array.from({ length: 8 }, (_, i) => `tail ${i}`).join("\n")}\n`;
    const failure = localRunFailure({
      ...base,
      error,
      workspace: "C:/work",
      activity: [
        {
          at: "2026-11-15T10:00:00Z",
          kind: "edit",
          summary: "C:/work/src/a.ts, C:/work/src/b.ts",
        },
      ],
    })!;
    expect(failure.title).toBe("Commit hook failed");
    expect(failure.excerpt.split("\n")[0]).toBe(
      "Test Files  2 failed | 30 passed",
    );
    expect(failure.excerpt.split("\n")).toHaveLength(12);
    expect(failure.log).not.toContain("\u001b");
    expect(failure.kept).toBe("2 files · delivery/HUB-118-cac958d7");
  });

  it("names the first failed or inconclusive host check", () => {
    const checks = [
      { name: "typecheck", exit: 0, error: null },
      { name: "lint", exit: null, error: "timeout" },
      { name: "test", exit: 1, error: null },
    ];
    expect(
      localRunFailure({ ...base, error: "host checks failed", checks }),
    ).toMatchObject({ stage: "Verify", station: "lab", title: "lint failed" });
  });

  it("uses actual milestones for unknown errors and never implies that work was lost", () => {
    expect(
      localRunFailure({ ...base, error: "Unknown fault\nstack" }),
    ).toMatchObject({ stage: "Setup", title: "Unknown fault" });
    expect(
      localRunFailure({
        ...base,
        error: "Unknown fault",
        activity: [
          { at: "2026-11-15T10:00:00Z", summary: "Native session started" },
        ],
      })?.stage,
    ).toBe("Build");
    expect(
      localRunFailure({ ...base, error: "Unknown fault", head: "abc" })?.stage,
    ).toBe("Verify");
    expect(localRunFailure(base)).toBeNull();
  });

  it("caps the initial full-log disclosure at its final 20KB", () => {
    const error = `git commit: ${"x".repeat(21_000)}\nlast cause`;
    const failure = localRunFailure({ ...base, error })!;
    expect(failure.tail).toHaveLength(20_000);
    expect(failure.tail.endsWith("last cause")).toBe(true);
    expect(failure.truncated).toBe(true);
    expect(stripAnsi("\u001b[1;31mFAIL\u001b[0m")).toBe("FAIL");
  });

  it("moves only the last matching summary and preserves repeated recorded lines", () => {
    const lines = [
      "Error: repeated",
      ...Array.from({ length: 9 }, (_, i) => `line ${i}`),
      "Error: repeated",
      "last line",
    ];
    const failure = localRunFailure({
      ...base,
      error: `git commit: hook\n${lines.join("\n")}`,
    })!;
    expect(failure.excerpt.split("\n")).toHaveLength(12);
    expect(
      failure.excerpt.split("\n").filter((line) => line === "Error: repeated"),
    ).toHaveLength(2);
    expect(failure.excerpt.split("\n")[0]).toBe("Error: repeated");
  });
});
