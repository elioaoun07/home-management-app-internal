import type { QueryClient } from "@tanstack/react-query";
import { mealPlanKeys } from "@/features/meal-planning/queryKeys";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { qk } from "@/lib/queryKeys";
import { queryKeys } from "@/lib/queryConfig";
import { eraKeys } from "../queryKeys";
import { useEraStore } from "../useEraStore";
import { recordEraArtifacts } from "../recordArtifacts";
import { getCapability } from "./registry";
import type { EraCapabilityResult } from "./types";

/** Shared post-execution seam, including partial writes. Realtime is not a
 * substitute for invalidating the calling device's cached module data. */
export function applyCapabilityResult(
  id: string,
  result: EraCapabilityResult,
  qc: QueryClient,
  opts: { recordArtifacts?: boolean; updateContext?: boolean } = {},
): void {
  if (opts.recordArtifacts !== false) recordEraArtifacts(result.artifacts, qc);
  const store = useEraStore.getState();
  if (opts.updateContext !== false) {
    if (result.pending) store.setPendingTurn(result.pending);
    if (result.proposal) store.setActiveProposal(result.proposal);
    if (result.focus) store.pushFocusEntity(result.focus);
    else if (
      id !== "reminder.delete" &&
      typeof result.metadata?.itemId === "string" &&
      typeof result.metadata.title === "string"
    ) {
      store.pushFocusEntity({
        id: result.metadata.itemId,
        type: "reminder",
        title: result.metadata.title,
        addedAt: Date.now(),
      });
    }
    if (
      id === "reminder.delete" &&
      typeof result.metadata?.deletedItemId === "string"
    ) {
      useEraStore.setState({
        focusEntities: store.focusEntities.filter(
          (e) => e.id !== result.metadata?.deletedItemId,
        ),
      });
    }
  }
  const cap = getCapability(id);
  if (!cap || cap.operation === "read") return;
  // Even a failed write can have partially completed, or timed out after commit.
  qc.invalidateQueries({ queryKey: eraKeys.widgets.budget() });
  qc.invalidateQueries({ queryKey: eraKeys.widgets.schedule() });
  qc.invalidateQueries({ queryKey: eraKeys.widgets.chef() });
  qc.invalidateQueries({ queryKey: eraKeys.widgets.brain() });
  switch (cap.entity) {
    case "reminder":
      qc.invalidateQueries({ queryKey: qk.scheduleItems() });
      qc.invalidateQueries({ queryKey: qk.nfcTagItemsAll() });
      break;
    case "meal":
      qc.invalidateQueries({ queryKey: mealPlanKeys.all });
      break;
    case "shopping":
      qc.invalidateQueries({ queryKey: qk.hubThreads() });
      if (typeof result.metadata?.threadId === "string")
        qc.invalidateQueries({
          queryKey: qk.hubMessages(result.metadata.threadId),
        });
      break;
    case "transaction":
      invalidateAccountData(
        qc,
        typeof result.metadata?.accountId === "string"
          ? result.metadata.accountId
          : undefined,
      );
      qc.invalidateQueries({ queryKey: qk.drafts() });
      qc.invalidateQueries({ queryKey: queryKeys.transactions() });
      qc.invalidateQueries({
        predicate: (q) =>
          ["account-balance", "transactions", "transactions-today"].includes(
            String(q.queryKey[0]),
          ),
      });
      break;
  }
}
