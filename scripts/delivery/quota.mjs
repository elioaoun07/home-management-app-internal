// scripts/delivery/quota.mjs
// Classify a driver turn error so the runner can tell a provider allowance
// exhaustion (subscription session limit, API rate limit, quota) apart from
// an ordinary transient failure.
//
// Root cause (BUD-11 session forensics, s-20260715-214421-hvfk): after the
// owner retried a BLOCKED session, the runner spun up five fresh driver
// sessions in two minutes, each immediately failing with "You've hit your
// session limit" — the 2-attempt retry loop had no way to recognize that a
// quota error is never worth retrying, so every retry (and every owner
// "Retry" click) just burned another failed session-establish against the
// same exhausted allowance. This module gives runGuardedTurn a cheap,
// provider-agnostic way to skip straight to BLOCKED on that class of error.
//
// Pure string matching, zero-dependency — provider error message wording is
// the only signal available at this layer (drivers throw a plain DriverError
// with the provider SDK's message text, not a typed error code).

const QUOTA_PATTERNS = [
  /session limit/i,
  /rate.?limit/i,
  /usage limit/i,
  /\bquota\b/i,
  /insufficient_quota/i,
  /\b429\b/,
  /too many requests/i,
  /spend limit/i,
  /monthly.*limit/i,
  /\bcredit(?:s)?\b/i,
];

// DLV-44: the lane's own `maxInternalTurns` ceiling (D9/DLV-6), hit from
// inside the SDK. This is emphatically NOT transient — the next attempt sends
// the same prompt into the same ceiling and dies at the same place, so the
// generic retry bucket burned two guaranteed-doomed attempts before escalating
// (s-20260729-121840-pdhx: FAST's cap of 8 against a DISCOVERY prompt whose
// own mandated reading list is ~8 tool calls before any real work begins).
// It is also not a provider fault the owner can only wait out, like quota —
// it is a *sizing* verdict with two real owner actions (raise the lane's cap,
// or narrow the prompt's mandated reading), which is why it escalates to a
// decision rather than dead-ending in BLOCKED.
const MAX_TURNS_PATTERNS = [
  /maximum number of turns/i,
  /\bmax_turns\b/i,
  /\berror_max_turns\b/i,
];

const AUTH_PATTERNS = [
  /authentication(?:_failed| failed)?/i,
  /\bauth(?:entication)?\b.*(?:fail|invalid|expired|required|unavailable)/i,
  /(?:invalid|expired)\s+(?:access\s+)?token/i,
  /\bunauthori[sz]ed\b/i,
  /\b401\b/,
];

// Matches a trailing "resets <time>" fragment as seen in Claude Code's own
// session-limit message ("You've hit your session limit · resets 12:30am
// (Asia/Beirut)") — best-effort only; the reset time is free text from the
// provider, not a parsed Date, so callers treat it as display-only.
const RESET_TIME_RE = /resets\s+([^,;]+?)(?:$|[.\n])/i;

/**
 * @param {unknown} err
 * @param {{extraQuotaPatterns?:string[]}} [options]
 * @returns {{kind:"quota"|"auth"|"max-turns"|"transient", retryable:boolean, resetsAt:(string|null)}}
 */
export function classifyTurnError(err, options = {}) {
  const message = String((err && err.message) || err || "");
  const extraPatterns = (options.extraQuotaPatterns || []).flatMap((source) => {
    try { return [new RegExp(source, "i")]; } catch { return []; }
  });
  if ([...QUOTA_PATTERNS, ...extraPatterns].some((re) => re.test(message))) {
    const resetsMatch = message.match(RESET_TIME_RE);
    return { kind: "quota", retryable: false, resetsAt: resetsMatch ? resetsMatch[1].trim() : null };
  }
  if (AUTH_PATTERNS.some((re) => re.test(message))) return { kind: "auth", retryable: false, resetsAt: null };
  if (MAX_TURNS_PATTERNS.some((re) => re.test(message))) return { kind: "max-turns", retryable: false, resetsAt: null };
  return { kind: "transient", retryable: true, resetsAt: null };
}
