import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as mobile from "./detectors/hr-5-mobile-evidence.mjs";
import * as production from "./detectors/hr-26-production-tools.mjs";
import * as rls from "./detectors/hr-27-rls-order.mjs";
import * as paid from "./detectors/hr-29-paid-api.mjs";
/** @type {Array<[string, typeof mobile]>} */
export const TRANSCRIPT_DETECTORS = [
  ["hr-5-mobile-evidence", mobile],
  ["hr-26-production-tools", production],
  ["hr-27-rls-order", rls],
  ["hr-29-paid-api", paid],
];
export function evaluateTranscript(session, changes) {
  return TRANSCRIPT_DETECTORS.map(([id, d]) => {
    const fixtures = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../tests/os/fixtures/detectors/" + id + ".json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    );
    for (const expected of ["fail", "pass", "n/a"]) {
      const fixture = fixtures.find((f) => f.expected === expected);
      if (!fixture || d.detect(fixture).verdict !== expected)
        throw new Error(
          "Transcript detector fixture gate failed: " + id + " " + expected,
        );
    }
    const verdict = d.detect({ session, changes });
    if (!verdict) throw new Error("Missing transcript verdict: " + id);
    return { ...verdict, detector: id, version: d.meta.version };
  });
}
