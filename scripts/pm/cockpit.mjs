// R97: a read-only view over A1–A4. No ingest, detector definitions or new store.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { check } from "../os/check.mjs";
import { collect } from "../os/score.mjs";
import { comparisons } from "../os/scorecard.mjs";
import { openStore, assertVersion } from "../os/store.mjs";
import { safeFacts, redact } from "../os/privacy.mjs";
import { pmFacts } from "../os/item.mjs";
import { weekOf } from "./shared/metrics.mjs";

export function cockpit(root) {
  const warnings = [];
  let setup = null,
    conflicts = [],
    records = [],
    deliveries = [],
    groups = [];
  try {
    const result = check(root);
    setup = result.setup;
    conflicts = result.rows;
  } catch (error) {
    warnings.push("Setup unavailable: " + redact(error.message));
  }
  try {
    const data = collect({ root });
    deliveries = data.deliveries;
    const byId = new Map(data.records.map((r) => [r.session.id, r]));
    if (existsSync(join(root, ".os/os.db"))) {
      const store = openStore(root, { readOnly: true });
      try {
        for (const session of data.sessions) {
          if (!byId.has(session.id))
            byId.set(session.id, store.get(session.id));
        }
      } finally {
        store.close();
      }
    }
    records = data.sessions
      .map((session) => {
        assertVersion(session, "os/session@1");
        if (session.scorecard)
          assertVersion(session.scorecard, "os/scorecard@1");
        return { ...byId.get(session.id), session };
      })
      .sort(
        (a, b) =>
          (b.session.startedAt || "").localeCompare(
            a.session.startedAt || "",
          ) || a.session.id.localeCompare(b.session.id),
      );
    groups = comparisons(data.sessions, deliveries).map((group) => {
      const ids = new Set(group.raw.map((row) => row.id));
      const ordered = data.sessions
        .filter((s) => ids.has(s.id) && s.startedAt)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const trend = ordered.flatMap((s, i) => {
        if (
          ordered[i + 1] &&
          weekOf(ordered[i + 1].startedAt.slice(0, 10)) ===
            weekOf(s.startedAt.slice(0, 10))
        )
          return [];
        const prefix = comparisons(ordered.slice(0, i + 1))[0];
        return prefix?.statisticsEligible
          ? [
              {
                at: s.startedAt,
                sessionId: s.id,
                n: prefix.n,
                rates: prefix.rates,
              },
            ]
          : [];
      });
      return { ...group, trend };
    });
    if (data.deliveryWarning) warnings.push(data.deliveryWarning);
  } catch (error) {
    warnings.push("Sessions unavailable: " + redact(error.message));
  }
  // Filing dates are A4's explicit PM facts; absent dates stay unrecorded.
  let filed = [];
  try {
    filed = pmFacts(root);
  } catch (error) {
    warnings.push("Filing evidence unavailable: " + redact(error.message));
  }
  return safeFacts({
    setup,
    conflicts,
    records,
    deliveries,
    groups,
    filed,
    warnings,
  });
}
