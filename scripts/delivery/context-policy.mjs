// scripts/delivery/context-policy.mjs
// The context policy engine (DW-7): a pure, deterministic decision procedure
// that picks how the next turn should relate to provider state — resume the
// existing session as-is, resume with a model/effort override, rotate to a
// fresh thread, hand off to a different provider, or fork. Every decision
// carries `reasons` so the timeline/inspector can explain *why* (auditability
// by construction) — see ERA Notes/10 - Project Management/Delivery Workspace/.
//
// Pure function, no I/O. Callers (run-session.mjs) gather the inputs from
// state.execution / usage.mjs occupancy / config.mjs thresholds.

export const CONTEXT_STRATEGIES = Object.freeze([
  "resume-native",
  "resume-with-overrides",
  "rotate-fresh",
  "handoff",
  "fork",
]);

/**
 * @param {{hasEstablishedRef?:boolean, resumeAfterCrash?:boolean, pendingProviderSwitch?:boolean,
 *   pendingFork?:boolean, pendingModelChange?:boolean, pendingEffortChange?:boolean,
 *   ownerRotateRequested?:boolean, isPhaseBoundary?:boolean, occupancyTokens?:number,
 *   windowTokens?:(number|null), rotateAtTokens?:(number|null), hardCeilingPct?:(number|null),
 *   sameStateReentryCount?:number, forkAfterPhaseRetries?:(number|null)}} [input]
 * @returns {{strategy:string, reasons:string[], suggested?:boolean, partialPhaseDigest?:boolean}}
 */
export function decideContextStrategy({
  hasEstablishedRef = false,
  resumeAfterCrash = false,
  pendingProviderSwitch = false,
  pendingFork = false,
  pendingModelChange = false,
  pendingEffortChange = false,
  ownerRotateRequested = false,
  isPhaseBoundary = false,
  occupancyTokens = 0,
  windowTokens = null,
  rotateAtTokens = null,
  hardCeilingPct = null,
  sameStateReentryCount = 0,
  forkAfterPhaseRetries = null,
} = {}) {
  if (resumeAfterCrash && hasEstablishedRef) {
    return { strategy: "resume-native", reasons: ["resume-after-crash with an already-established provider ref"] };
  }
  if (pendingProviderSwitch) {
    return { strategy: "handoff", reasons: ["owner requested a provider switch"] };
  }
  if (pendingFork) {
    return { strategy: "fork", reasons: ["owner requested a fork"] };
  }
  if (pendingModelChange) {
    return {
      strategy: "resume-with-overrides",
      reasons: ["owner changed the model — the provider prompt cache will be cold on the next turn"],
    };
  }
  if (pendingEffortChange) {
    return { strategy: "resume-with-overrides", reasons: ["owner changed effort for this phase"] };
  }
  if (ownerRotateRequested) {
    return { strategy: "rotate-fresh", reasons: ["owner explicitly requested a context rotation"] };
  }
  if (isPhaseBoundary && rotateAtTokens != null && occupancyTokens >= rotateAtTokens) {
    return {
      strategy: "rotate-fresh",
      reasons: [`occupancy ${occupancyTokens} tokens >= rotateAtTokens ${rotateAtTokens} at a phase boundary`],
    };
  }
  if (!isPhaseBoundary && windowTokens != null && hardCeilingPct != null && occupancyTokens >= windowTokens * hardCeilingPct) {
    return {
      strategy: "rotate-fresh",
      reasons: [`projected occupancy ${occupancyTokens} tokens >= ${Math.round(hardCeilingPct * 100)}% of the ${windowTokens}-token window mid-phase`],
      partialPhaseDigest: true,
    };
  }
  if (forkAfterPhaseRetries != null && sameStateReentryCount >= forkAfterPhaseRetries) {
    return {
      strategy: "rotate-fresh",
      reasons: [`phase re-entered ${sameStateReentryCount} times (>= ${forkAfterPhaseRetries}) — rotation suggested to escape a possibly poisoned context`],
      suggested: true,
    };
  }
  return { strategy: "resume-native", reasons: ["no rotation/handoff/fork trigger matched — resuming the existing provider session"] };
}
