// R97: a read-only view over A1–A4. No ingest, detector definitions or new store.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../os/check.mjs";
import { collect } from "../os/score.mjs";
import { comparisons } from "../os/scorecard.mjs";
import { openStore, assertVersion } from "../os/store.mjs";
import { safeFacts, redact } from "../os/privacy.mjs";
import { pmFacts } from "../os/item.mjs";
import { weekOf } from "./shared/metrics.mjs";
import { writeSnapshot } from "../os/scan.mjs";

export function cockpit(
  root,
  { refreshRegistry = false, deliverySnapshot = null } = {},
) {
  const warnings = [];
  let setup = null,
    conflicts = [],
    records = [],
    deliveries = [],
    groups = [],
    nativeSessions = [],
    sessionsAvailable = false;
  try {
    let result = check(root);
    if (
      refreshRegistry === "force" ||
      (refreshRegistry && result.rows.some((row) => row.code === "DRIFT"))
    ) {
      writeSnapshot(result.setup, root);
      result = check(root);
    }
    setup = result.setup;
    conflicts = result.rows;
  } catch (error) {
    warnings.push("Setup unavailable: " + redact(error.message));
  }
  try {
    const data = collect({ root, deliverySnapshot });
    nativeSessions = data.nativeSessions;
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
    sessionsAvailable = true;
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
  const marker = join(root, ".os/recorder-unavailable");
  const since = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
  const recorder = {
    state: since !== null ? "unavailable" : "recording",
    since,
  };
  // Only native transcript observations establish skill use; projected Local
  // sessions cannot claim a skill merely because a work item recommends it.
  const skills = new Map();
  for (const session of nativeSessions) {
    const seen = new Set();
    for (const skill of session.skills || []) {
      if (typeof skill.name !== "string") continue;
      const current = skills.get(skill.name) || {
        name: skill.name,
        lastUsed: null,
        sessions: 0,
      };
      const at = skill.at || session.startedAt;
      if (at && (!current.lastUsed || at > current.lastUsed))
        current.lastUsed = at;
      if (!seen.has(skill.name)) current.sessions++;
      seen.add(skill.name);
      skills.set(skill.name, current);
    }
  }
  return safeFacts({
    setup,
    conflicts,
    records,
    deliveries,
    groups,
    filed,
    warnings,
    recorder,
    skillUsage: {
      available: recorder.state === "recording" && sessionsAvailable,
      recordedSessions: nativeSessions.length,
      skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
  });
}
