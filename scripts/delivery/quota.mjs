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
];

// Matches a trailing "resets <time>" fragment as seen in Claude Code's own
// session-limit message ("You've hit your session limit · resets 12:30am
// (Asia/Beirut)") — best-effort only; the reset time is free text from the
// provider, not a parsed Date, so callers treat it as display-only.
const RESET_TIME_RE = /resets\s+([^,;]+?)(?:$|[.\n])/i;

/**
 * @param {unknown} err
 * @returns {{kind:"quota"|"transient", retryable:boolean, resetsAt:(string|null)}}
 */
export function classifyTurnError(err) {
  const message = String((err && err.message) || err || "");
  if (QUOTA_PATTERNS.some((re) => re.test(message))) {
    const resetsMatch = message.match(RESET_TIME_RE);
    return { kind: "quota", retryable: false, resetsAt: resetsMatch ? resetsMatch[1].trim() : null };
  }
  return { kind: "transient", retryable: true, resetsAt: null };
}
