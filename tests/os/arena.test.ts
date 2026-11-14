import { describe, expect, it } from "vitest";
import {
  caseFingerprint,
  caseSchema,
  loadCase,
} from "../../scripts/os/arena.mjs";

describe("R99 case freeze", () => {
  it("binds brief, start, oracle and scope in one deterministic fingerprint", () => {
    const spec = loadCase();
    expect(spec.schema).toBe("os/case@1");
    expect(caseFingerprint(spec)).toBe(
      caseFingerprint(JSON.parse(JSON.stringify(spec))),
    );
    for (const changed of [
      { ...spec, brief: "different" },
      { ...spec, start: "a".repeat(40) },
      { ...spec, oracleHash: "sha256:" + "a".repeat(64) },
      { ...spec, paths: ["other.ts"] },
    ])
      expect(caseFingerprint(changed)).not.toBe(caseFingerprint(spec));
  });
  it("refuses unknown versions, arbitrary oracle inventory and escaping paths", () => {
    expect(() => loadCase("../../secret")).toThrow("Unknown Arena case");
    expect(() =>
      caseSchema.parse({ ...loadCase(), schema: "os/case@2" }),
    ).toThrow();
    for (const bad of [
      "../outside.ts",
      "C:\\secret",
      "/../absolute",
      "/absolute",
    ])
      expect(() => caseSchema.parse({ ...loadCase(), paths: [bad] })).toThrow();
  });
});
