import type { Flight } from "./cockpitTypes";

// Compatibility is about frozen work and setup, never just a matching item label.
export function compareArena(left?: Flight, right?: Flight) {
  if (!left || !right)
    return { comparable: false, reasons: ["Two runs required"] };
  const a = left.session,
    b = right.session,
    reasons: string[] = [];
  if (a.id === b.id) reasons.push("Select distinct runs");
  if (!a.arena || !b.arena) reasons.push("Case binding unrecorded");
  else {
    if (
      a.arena.caseId !== b.arena.caseId ||
      !a.arena.caseFingerprint ||
      a.arena.caseFingerprint !== b.arena.caseFingerprint
    )
      reasons.push("Different cases");
    if (
      a.arena.start !== b.arena.start ||
      a.base !== a.arena.start ||
      b.base !== b.arena.start
    )
      reasons.push("Different starting commits");
    if (!a.arena.oracleHash || a.arena.oracleHash !== b.arena.oracleHash)
      reasons.push("Different oracles");
    if (a.arena.isolation !== "protected" || b.arena.isolation !== "protected")
      reasons.push("Oracle isolation unverified");
    if (
      ![a.arena.oracleVerdict, b.arena.oracleVerdict].every((v) =>
        ["pass", "fail"].includes(v),
      )
    )
      reasons.push("Oracle result unrecorded");
  }
  if (!a.setup?.fingerprint || a.setup.fingerprint !== b.setup?.fingerprint)
    reasons.push("Setup differs or is unrecorded");
  if (!a.effort || a.effort !== b.effort)
    reasons.push("Effort differs or is unrecorded");
  if (!a.tier || !b.tier || a.tier === b.tier)
    reasons.push("Two tier aliases required");
  if (!a.scorecard || !b.scorecard) reasons.push("Scorecard unrecorded");
  if (![a.head, b.head].every((head) => head && /^[0-9a-f]{40}$/.test(head)))
    reasons.push("Candidate commit unrecorded");
  if (
    [a, b].some(
      (s) =>
        s.scorecard &&
        (s.scorecard.sessionId !== s.id ||
          s.scorecard.setup !== s.setup?.fingerprint ||
          s.scorecard.tier !== s.tier ||
          s.scorecard.effort !== s.effort),
    )
  )
    reasons.push("Scorecard binding differs");
  if (
    ![a.agent, b.agent].includes("claude") ||
    ![a.agent, b.agent].includes("codex")
  )
    reasons.push("Claude and Codex required");
  return { comparable: reasons.length === 0, reasons };
}
