import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { scan, writeSnapshot, readSnapshot } from "../../scripts/os/scan.mjs";
import { check } from "../../scripts/os/check.mjs";
import { openStore } from "../../scripts/os/store.mjs";
import { cockpit } from "../../scripts/pm/cockpit.mjs";
import { createCockpitReader } from "../../scripts/pm/cockpit-reader.mjs";
import { routeCockpitRescan } from "../../scripts/pm/cockpit-route.mjs";
import {
  issuePairingCode,
  pairSession,
  sessionView,
} from "../../scripts/delivery-v2/local-auth.mjs";

const scratch = mkdtempSync(join(tmpdir(), "r128-registry-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let sequence = 0;
function fixture() {
  const root = join(scratch, String(sequence++));
  mkdirSync(root);
  expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
  mkdirSync(join(root, "ERA Notes/10 - Project Management"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "CLAUDE.md"),
    "# Setup\n\n## Hard Rules\n1. A fixture rule\n",
  );
  expect(spawnSync("git", ["add", "."], { cwd: root }).status).toBe(0);
  expect(
    spawnSync(
      "git",
      [
        "-c",
        "user.name=R128",
        "-c",
        "user.email=r128@example.invalid",
        "-c",
        "core.hooksPath=.no-hooks",
        "-c",
        "commit.gpgSign=false",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    ).status,
  ).toBe(0);
  return root;
}

describe("R128 fresh registry and recorder facts", () => {
  it("rescans stale saved setup in the worker while the CLI retains drift failure", async () => {
    const root = fixture();
    writeSnapshot(scan(root), root);
    const old = readSnapshot(root)!.fingerprint;
    writeFileSync(
      join(root, "CLAUDE.md"),
      "# Changed setup\n\n## Hard Rules\n1. A fixture rule\n",
    );
    expect(check(root).rows.some((row) => row.code === "DRIFT")).toBe(true);
    const reader = createCockpitReader({
      root,
      intervalMs: 0,
      autoStart: false,
    });
    try {
      await reader.refresh();
      expect(reader.read().stale).toBe(false);
      expect(reader.read().setup?.fingerprint).not.toBe(old);
      expect(readSnapshot(root)!.fingerprint).toBe(
        reader.read().setup?.fingerprint,
      );
      expect(check(root).rows.some((row) => row.code === "DRIFT")).toBe(false);
      await reader.rescan();
      expect(reader.read().stale).toBe(false);
    } finally {
      reader.stop();
    }
  }, 60_000);

  it("exposes recorded skill dates and unique session counts, withholding availability on recorder failure", () => {
    const root = fixture(),
      store = openStore(root);
    try {
      for (let i = 0; i < 2; i++)
        store.put({
          session: {
            schema: "os/session@1",
            id: `skill-${i}`,
            agent: "claude",
            coverage: "transcript",
            startedAt: `2026-11-${14 + i}T06:00:00Z`,
            skills: [
              { name: "start-task", at: `2026-11-${14 + i}T06:01:00Z` },
              { name: "start-task", at: `2026-11-${14 + i}T06:02:00Z` },
            ],
          },
          events: [],
          verdicts: [],
          checks: [],
        });
    } finally {
      store.close();
    }
    expect(cockpit(root).skillUsage).toEqual({
      available: true,
      recordedSessions: 2,
      skills: [
        { name: "start-task", sessions: 2, lastUsed: "2026-11-15T06:02:00Z" },
      ],
    });
    writeFileSync(
      join(root, ".os/recorder-unavailable"),
      "2026-11-15T06:39:25.775Z",
    );
    const data = cockpit(root);
    expect(data.recorder).toEqual({
      state: "unavailable",
      since: "2026-11-15T06:39:25.775Z",
    });
    expect(data.skillUsage.available).toBe(false);
  }, 60_000);

  it("limits Rescan to a same-origin loopback browser with valid session and CSRF", async () => {
    const root = fixture();
    const code = issuePairingCode({ root }).code;
    const paired = pairSession({ root, code });
    const cookie = `era_v2_session=${paired.token}`;
    const csrf = sessionView({ root, headers: { cookie } }).csrf;
    const headers = {
      host: "127.0.0.1:4317",
      origin: "http://127.0.0.1:4317",
      "sec-fetch-site": "same-origin",
      cookie,
      "x-era-csrf": csrf,
    };
    const reader = {
      rescan: vi.fn(async () => {}),
      read: () => ({ stale: false }),
    };
    const request = { root, reader, headers, loopbackPeer: true, body: {} };
    expect(
      (await routeCockpitRescan({ ...request, loopbackPeer: false })).status,
    ).toBe(403);
    expect(
      (
        await routeCockpitRescan({
          ...request,
          headers: { ...headers, origin: "http://elsewhere.invalid" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await routeCockpitRescan({
          ...request,
          headers: { ...headers, "x-era-csrf": "bad" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await routeCockpitRescan({ ...request, body: { anything: true } }))
        .status,
    ).toBe(400);
    expect((await routeCockpitRescan(request)).status).toBe(200);
    expect(reader.rescan).toHaveBeenCalledTimes(1);
  }, 60_000);
});
