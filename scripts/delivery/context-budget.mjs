// scripts/delivery/context-budget.mjs
// DLV-8 (remaining half): per-lane, per-phase context budgets with
// priority-ordered dropping, and the per-turn loaded-context manifest.
//
// DLV-45 narrowed FAST's mandated reading list by hand — campaign docs dropped,
// skills narrowed to those a risk flag implicates. That was the right call for
// that lane, but it is a hard-coded rule, not a budget: nothing stops a
// STANDARD session from being handed six campaign docs and nine skills, and
// nothing anywhere records what the turn was actually told to read. The failed
// Haiku session processed 8.7M cached-input tokens with no manifest to explain
// where any of it came from.
//
// The priority order is the same one the action plan states, and it is ordered
// by how *specific to this work item* a source is:
//
//   item (0)  — the work item itself. Never droppable; without it there is no task.
//   doctrine (1) — CLAUDE.md's house rules. Droppable only where DLV-45 already drops it.
//   skill (2) — a playbook attached by a risk flag; specific to this kind of change.
//   campaign (3) — strategy docs for the whole campaign; the least item-specific
//                  thing in the list, and the first thing worth losing.
//
// Dropping is recorded, never silent: a turn that was denied its campaign docs
// says so, in an artifact, with the number that caused it.
//
// Pure: sizes come from the caller (a stat, not a read — measuring a file must
// not cost what reading it would).

/** Lower number = kept longer. */
export const SOURCE_PRIORITY = Object.freeze({ item: 0, doctrine: 1, skill: 2, campaign: 3 });

/** Chars-per-token heuristic, matching context-assembly.mjs's `estimateTokens`. */
export function tokensForBytes(bytes) {
  const n = Number(bytes);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n / 4) : 0;
}

/**
 * Apply a token budget to a phase's mandated reading list.
 *
 * `null`/absent budget means "no budget configured" and keeps everything — the
 * behaviour every lane had before this existed. An owner who has not opted into
 * a budget never gets one by accident.
 *
 * @param {{sources:{kind:string, path:string, tokensEst:number}[], budgetTokens:(number|null)}} args
 * @returns {{kept:object[], dropped:{kind:string, path:string, tokensEst:number, reason:string}[],
 *   totalTokensEst:number, budgetTokens:(number|null)}}
 */
export function applyContextBudget({ sources = [], budgetTokens = null } = {}) {
  const all = sources.map((s) => ({ ...s, tokensEst: s.tokensEst || 0 }));
  const total = all.reduce((sum, s) => sum + s.tokensEst, 0);
  if (!budgetTokens || budgetTokens <= 0 || total <= budgetTokens) {
    return { kept: all, dropped: [], totalTokensEst: total, budgetTokens: budgetTokens || null };
  }

  // Drop lowest-priority first; within a priority, drop the largest first so
  // the fewest sources are sacrificed to get under the line.
  const ordered = [...all].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.kind] ?? 99;
    const pb = SOURCE_PRIORITY[b.kind] ?? 99;
    if (pa !== pb) return pb - pa;
    return b.tokensEst - a.tokensEst;
  });

  const droppedPaths = new Set();
  let running = total;
  for (const source of ordered) {
    if (running <= budgetTokens) break;
    // `item` is never droppable: a turn with no work item has nothing to do.
    if (source.kind === "item") continue;
    droppedPaths.add(source.path);
    running -= source.tokensEst;
  }

  const kept = all.filter((s) => !droppedPaths.has(s.path));
  const dropped = all
    .filter((s) => droppedPaths.has(s.path))
    .map((s) => ({
      ...s,
      reason: `over the ${budgetTokens.toLocaleString()}-token budget for this lane/phase (list totalled ${total.toLocaleString()})`,
    }));
  return { kept, dropped, totalTokensEst: running, budgetTokens };
}

/**
 * The per-turn loaded-context manifest.
 *
 * De-duplicated against the packet on purpose: since DLV-8's first half the
 * packet is referenced by path rather than embedded, so counting it as loaded
 * context would double-count the one thing that is deliberately *not* being
 * re-sent each turn. It is listed as `referenced`, with its cost attributed to
 * the turn only if the agent chooses to read it.
 *
 * @param {{turnId:(string|null), phase:string, lane:(string|null), packetPath:string,
 *   kept:object[], dropped:object[], budgetTokens:(number|null), promptTokensEst?:number}} args
 */
export function buildContextManifest({
  turnId,
  phase,
  lane = null,
  packetPath,
  kept = [],
  dropped = [],
  budgetTokens = null,
  promptTokensEst = 0,
}) {
  return {
    schemaVersion: 1,
    turnId: turnId || null,
    phase,
    lane,
    budgetTokens,
    promptTokensEst,
    loaded: kept.map((s) => ({ kind: s.kind, path: s.path, tokensEst: s.tokensEst })),
    dropped: dropped.map((s) => ({ kind: s.kind, path: s.path, tokensEst: s.tokensEst, reason: s.reason })),
    referenced: [
      {
        kind: "packet",
        path: packetPath,
        // Not summed into `mandatedTokensEst`: referenced-by-path is exactly
        // the cost this design avoids paying per turn.
        note: "referenced by path, not embedded — costs tokens only if the agent reads it",
      },
    ],
    mandatedTokensEst: kept.reduce((sum, s) => sum + (s.tokensEst || 0), 0),
    droppedTokensEst: dropped.reduce((sum, s) => sum + (s.tokensEst || 0), 0),
  };
}

/**
 * Cap a replayed tool-output excerpt. The prior-validation excerpt handed to a
 * fix-loop BUILDING turn is the one piece of replayed tool output the runner
 * itself injects, and it is unbounded today — a 48-error typecheck dump is
 * re-sent on every internal turn that follows it.
 * @param {string} text
 * @param {number} maxChars
 */
export function boundReplayedOutput(text, maxChars = 8000) {
  const s = String(text == null ? "" : text);
  if (s.length <= maxChars) return s;
  const head = s.slice(0, Math.floor(maxChars * 0.6));
  const tail = s.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n\n… [${(s.length - head.length - tail.length).toLocaleString()} characters omitted to bound replayed tool output — the full text is in artifacts/validation-report.md] …\n\n${tail}`;
}
