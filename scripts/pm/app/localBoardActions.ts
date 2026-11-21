import type { LocalRunView } from "./LocalDelivery";
import type { AttentionItem } from "./localRunAttention";

type LocalAction = "review" | "ship" | "undo" | "cancel";
/** Shares LocalActions admission, including recovery of interrupted attempts. */
export function localBoardActionAllowed(
  run: LocalRunView,
  busy: boolean,
  action: LocalAction,
) {
  if (busy) return false;
  if (action === "review") return !!run.head;
  if (action === "ship") return run.canShip || run.phase === "push-pending";
  if (action === "undo")
    return run.canUndo || run.phase === "revert-push-pending";
  return ["preparing", "building", "checking"].includes(run.phase);
}
export function attentionActionAllowed(
  run: LocalRunView,
  busy: boolean,
  item: AttentionItem,
) {
  const action = item.action.run;
  if (action === "test") return !!item.action.href;
  if (action === "review" || action === "cancel")
    return localBoardActionAllowed(run, busy, action);
  if (action === "retry")
    return localBoardActionAllowed(
      run,
      busy,
      run.phase === "revert-push-pending" ? "undo" : "ship",
    );
  return true;
}
