// Pure fixtures for the container feasibility harness. No Docker: these pin the
// boundary shape and the verdict rules; the harness run itself is the receipt.
import { describe, expect, it } from "vitest";

import {
  CANARY_DOCKERFILE,
  REQUIRED_CONTROLS,
  canaryRunArgs,
  hardenedFlags,
  roleLayout,
  roleVerdict,
} from "../../scripts/delivery-v2/probes/container-feasibility.mjs";

const escaped = (canary: string, extra: Record<string, unknown> = {}) => ({ canary, outcome: "escaped", ...extra });
const denied = (canary: string) => ({ canary, outcome: "denied" });
const NEGATIVE = [
  escaped("scratch-write"),
  escaped("outside-write"),
  escaped("host-secret-read"),
  escaped("git-mutation"),
  escaped("link-escape"),
  escaped("store-access"),
  escaped("descendant-spawn", { heartbeatStarted: true }),
];
const HARDENED = [
  escaped("scratch-write"),
  denied("outside-write"),
  denied("git-mutation"),
  denied("host-secret-read"),
  denied("link-escape"),
  denied("store-access"),
  { canary: "network-egress", outcome: "inconclusive" },
  escaped("descendant-spawn", { heartbeatStarted: true }),
];

describe("container feasibility — boundary shape", () => {
  it("runs the worker unprivileged, read-only, capability-free and offline", () => {
    const flags = hardenedFlags().join(" ");
    expect(flags).toContain("--user 10001:10001");
    expect(flags).toContain("--read-only");
    expect(flags).toContain("--cap-drop ALL");
    expect(flags).toContain("--security-opt no-new-privileges");
    expect(flags).toContain("--network none");
    expect(flags).not.toMatch(/privileged|docker\.sock|--pid host|--network host/u);
  });

  it("mounts only named volumes, and the checker's candidate read-only", () => {
    for (const role of ["worker", "checker"] as const) {
      const layout = roleLayout({ run: "t", role, confined: true });
      const args = canaryRunArgs({ name: "host-secret-read", flags: hardenedFlags(), mounts: layout.mounts, paths: layout.paths, containerName: "c" });
      const mounts = args.filter((_, index) => args[index - 1] === "--mount");
      expect(mounts.length).toBe(layout.mounts.length);
      expect(mounts.every((mount) => mount.startsWith("type=volume,"))).toBe(true);
      expect(args).not.toContain("-v");
    }
    const checker = roleLayout({ run: "t", role: "checker", confined: true });
    expect(checker.mounts.find((mount) => mount.target === "/candidate")?.readonly).toBe(true);
    expect(roleLayout({ run: "t", role: "checker", confined: false }).mounts.find((mount) => mount.target === "/candidate")?.readonly).toBe(false);
  });

  it("bakes present-but-forbidden decoys rather than absent targets", () => {
    expect(CANARY_DOCKERFILE).toContain("chmod 0700 /host-private /supervisor");
    expect(CANARY_DOCKERFILE).toContain("chmod 0600 /host-private/secret.txt /supervisor/supervisor.db");
  });
});

describe("container feasibility — verdict", () => {
  const ev = { evidenceRef: "feasibility:test" };

  it("passes only with a valid negative control, every required denial and an observed stop", () => {
    const verdict = roleVerdict({ negativeRecords: NEGATIVE, hardenedRecords: HARDENED, descendantSurvived: false, ...ev });
    expect(verdict.met).toBe(true);
    expect(verdict.failing).toEqual([]);
    // Egress stays unverified; it is reported, not waived into a pass of its own.
    expect(verdict.unverified).toContain("network.egress");
    expect(REQUIRED_CONTROLS).not.toContain("network.egress");
  });

  it("fails when the negative control could not escape", () => {
    const negative = NEGATIVE.map((record) => (record.canary === "store-access" ? denied("store-access") : record));
    expect(roleVerdict({ negativeRecords: negative, hardenedRecords: HARDENED, descendantSurvived: false, ...ev }).met).toBe(false);
  });

  it("never treats an inconclusive link canary or an unobserved stop as proven", () => {
    const inconclusive = HARDENED.map((record) =>
      record.canary === "link-escape" ? { canary: "link-escape", outcome: "inconclusive" } : record,
    );
    const verdict = roleVerdict({ negativeRecords: NEGATIVE, hardenedRecords: inconclusive, descendantSurvived: false, ...ev });
    expect(verdict.met).toBe(false);
    expect(verdict.failing).toEqual(["filesystem.linkEscape"]);
    expect(roleVerdict({ negativeRecords: NEGATIVE, hardenedRecords: HARDENED, descendantSurvived: null, ...ev }).met).toBe(false);
  });
});
