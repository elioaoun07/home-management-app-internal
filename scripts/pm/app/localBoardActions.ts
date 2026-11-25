import type { LocalAction, LocalRunView } from "./LocalDelivery";
import type { AttentionItem } from "./localRunAttention";

/** Shares LocalActions admission, including recovery of interrupted attempts. */
export function localBoardActionAllowed(
  run: LocalRunView,
  busy: boolean,
  action: LocalAction,
) {
  if (busy) return false;
  if (action === "review") return !!run.head && run.phase === "uat-ready" && !run.merge_pending;
  if (action === "test") return !!run.handover;
  if (action === "refresh") return !!run.mergePlan?.canRefresh;
  if (action === "recheck" || action === "discard") return true;
  if (action === "commit" || action === "push")
    return run.publication?.action === action && !!run.publication.token && !run.publication.reason;
  if (action === "merge-by-hand") return run.phase === "uat-ready" && !run.merge_pending && !!run.canMergeByHand;
  if (action === "merge") return (run.phase === "uat-ready" || !!run.merge_pending) && !!run.canMerge;
  // DLV-175: the server's own admission flags for a paused Acceptance Check.
  if (action === "request-changes") return run.phase === "acceptance-paused" && !!run.canRequestChanges;
  if (action === "stop") return run.phase === "acceptance-paused" && !!run.canStop;
  if (action === "check-acceptance") return !!run.canRecheckAcceptance;
  return action === "cancel" && ["preparing", "building", "checking", "accepting"].includes(run.phase);
}
export function attentionActionAllowed(
  run: LocalRunView,
  busy: boolean,
  item: AttentionItem,
) {
  const action = item.action.run;
  if (action === "test" && run.phase === "acceptance-paused") return !busy;
  if (action === "test") return !busy && !!run.handover && !!item.action.href;
  if (action === "review" || action === "cancel")
    return localBoardActionAllowed(run, busy, action);
  if (action === "retry") return false;
  return true;
}
