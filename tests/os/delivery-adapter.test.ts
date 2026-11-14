import { afterAll, describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openStore as deliveryStore } from "../../scripts/delivery-v2/store.mjs";
import { readDelivery } from "../../scripts/os/ingest/delivery.mjs";
const root = mkdtempSync(join(tmpdir(), "era-a4-delivery-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim();
};
function commit() {
  git("add", ".");
  git(
    "-c",
    "user.name=A4",
    "-c",
    "user.email=a4@example.invalid",
    "-c",
    "core.hooksPath=.no-hooks",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  return git("rev-parse", "HEAD");
}
describe("A4 Delivery read-only adapter", () => {
  it("projects real supervisor SQLite rows, normalized usage, current-head checks and explicit unknown process", () => {
    git("init", "--quiet");
    writeFileSync(join(root, ".gitignore"), ".delivery/\n.os/\n");
    writeFileSync(join(root, "README.md"), "before");
    const base = commit();
    writeFileSync(join(root, "README.md"), "after");
    const head = commit();
    const path = join(root, ".delivery/v2/supervisor.sqlite");
    mkdirSync(join(root, ".delivery/v2"), { recursive: true });
    const db = deliveryStore({ path, now: () => "2026-11-01T10:00:00Z" });
    db.insertRun({
      run_id: "run",
      work_id: "R900",
      contract_id: "c",
      contract_revision: 1,
      lifecycle: "ACTIVE",
    });
    db.updateRun("run", {
      base_manifest_json: {
        lane: "local",
        work: { id: "R900" },
        settings: { executor: "codex", model: "gpt-6.1-sol", effort: "high" },
        base,
        head,
        phase: "uat-ready",
        checks: [
          {
            name: "typecheck",
            exit: 0,
            started_at: "2026-11-01T10:01:00Z",
            finished_at: "2026-11-01T10:02:00Z",
            stdout: "PRIVATE supervisor output",
            stderr: "",
          },
        ],
      },
    });
    const reservation = { unit: "tokens", amount: 100, basis: "subscription" };
    db.insertJob({
      job_id: "j1",
      run_id: "run",
      purpose: "build",
      backend_id: "codex-exec-sdk",
      dispatch_key: "j1",
      contract_id: "c",
      contract_revision: 1,
      grant_id: "g",
      grant_revision: 1,
      reservation,
      request: { settings: { model: "gpt-6.1-sol", effort: "high" } },
    });
    db.markDispatchStarted("j1", "2026-11-01T10:00:00Z");
    db.updateJob("j1", {
      status: "finished",
      observations_json: { nativeOutcome: "succeeded" },
    });
    const usage = {
      reading_key: "u1",
      unit: "tokens",
      input: 100,
      cachedInput: 50,
      output: 10,
    };
    db.recordUsageReading("j1", usage);
    db.recordUsageReading("j1", usage);
    db.appendActivity("run", "j1", [
      {
        kind: "status",
        summary: "Ready for owner UAT",
        at: "2026-11-01T10:03:00Z",
      },
    ]);
    db.close();
    const bytes = readFileSync(path),
      before = git("status", "--porcelain"),
      projected = readDelivery({ root, path, now: "2026-11-02T10:00:00Z" });
    expect(projected.records).toHaveLength(1);
    const r = projected.records[0];
    expect(r.session.itemId).toBe("R900");
    expect(r.session.usage.input_tokens).toBe(100);
    expect(r.session.scorecard.process.verdict).toBe("unknown");
    expect(
      r.session.scorecard.checks.facts.find((c) => c.name === "typecheck"),
    ).toMatchObject({
      verdict: "pass",
      source: "supervisor",
      exitCode: 0,
      durationMs: 60000,
    });
    const cli = spawnSync(
      process.execPath,
      [resolve("scripts/os/score.mjs"), "session", "delivery:j1"],
      { cwd: root, encoding: "utf8" },
    );
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain("### Process");
    expect(cli.stdout).toContain("Verdict: unknown");
    expect(r.session.head).toBe(head);
    expect(r.verdicts).toHaveLength(21);
    expect(projected.deliveries[0].n).toBe(1);
    expect(projected.deliveries[0].sessionsToShip).toBeNull();
    expect(JSON.stringify(projected)).not.toContain("PRIVATE");
    expect(readFileSync(path).equals(bytes)).toBe(true);
    expect(git("status", "--porcelain")).toBe(before);
    expect(existsSync(path + "-wal")).toBe(false);
    expect(existsSync(join(root, ".os"))).toBe(false);
    git(
      "-c",
      "core.hooksPath=.no-hooks",
      "-c",
      "user.name=A4",
      "-c",
      "user.email=a4@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "revert",
      "--no-edit",
      head,
    );
    expect(
      readDelivery({ root, path, now: "2026-11-02T10:00:00Z" }).deliveries[0]
        .reverted,
    ).toBe(true);
  });
  it("refuses unavailable or live-WAL sources instead of creating/checkpointing them", () => {
    const missing = join(root, "missing.sqlite");
    expect(() => readDelivery({ root, path: missing })).toThrow();
    expect(existsSync(missing)).toBe(false);
    const path = join(root, ".delivery/v2/supervisor.sqlite"),
      db = deliveryStore({ path });
    db.insertRun({
      run_id: "uncheckpointed",
      work_id: "R901",
      contract_id: "c",
      contract_revision: 1,
    });
    expect(() => readDelivery({ root, path })).toThrow(
      /WAL|read-only|snapshot/i,
    );
    db.close();
  });
});
