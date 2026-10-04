// src/features/era/nativeActions.ts
// HUB-76 — executes a native confirm card (EraActiveProposal kind
// "native_action") after the tap, and builds its inverse for the Undo toast.
// Money movement and deletes reach here ONLY through the card; the router and
// resolveIntent never write them directly (Plan §5).
//
// Undo runs at most once per execution: a second tap is a no-op client-side,
// and DELETE /api/transfers/[id] only reverses a transfer that is not already
// soft-deleted, so a replayed request cannot reverse the balances twice.

import type { QueryClient } from "@tanstack/react-query";
import { debtKeys } from "@/features/debts/useDebts";
import { transferKeys } from "@/features/transfers/hooks";
import { qk } from "@/lib/queryKeys";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { safeFetch } from "@/lib/safeFetch";
import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { getCapability } from "./capabilities/registry";
import { executeRecordDebt, executeTransfer } from "./intents/resolvers/budget";
import { executeCoverRecurring, undoCoverRecurring } from "./intents/resolvers/budgetFamilies";
import { createGroupAndMove } from "./intents/resolvers/amend";
import { moveShoppingItems, removeShoppingMessages, shoppingArtifacts } from "./intents/resolvers/shopping";
import { postponeNextOccurrence, resolveReminderReschedule, skipNextOccurrence } from "./intents/resolvers/schedule";
import type { EraNativeAction } from "./types";

export interface NativeActionResult {
  text: string;
  metadata?: Record<string, unknown>;
  outcome: "done" | "failed" | "uncertain";
  /** Present only where an inverse is demonstrated (Plan §5). */
  undo?: () => Promise<boolean>;
  /** What the write left behind (src/lib/era/artifacts.ts). */
  artifacts?: EraArtifact[];
}

function once(fn: () => Promise<boolean>): () => Promise<boolean> {
  let ran = false;
  return async () => {
    if (ran) return false;
    ran = true;
    return fn();
  };
}

async function del(url: string): Promise<boolean> {
  const res = await safeFetch(url, { method: "DELETE", timeoutMs: 8_000 });
  return res.ok;
}

/** Inverse of a reschedule: put the previous due_at back. */
export async function patchDueAt(itemId: string, dueAt: string, queryClient: QueryClient): Promise<boolean> {
  const res = await safeFetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ due_at: dueAt }),
    timeoutMs: 8_000,
  });
  queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
  return res.ok;
}

export async function executeNativeAction(
  action: EraNativeAction,
  queryClient: QueryClient,
): Promise<NativeActionResult> {
  if (action.type === "transfer") {
    const result = await executeTransfer(action);
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      invalidateAccountData(queryClient, action.fromAccountId);
      invalidateAccountData(queryClient, action.toAccountId);
    };
    // Refresh on uncertain too — the server may have committed it.
    if (result.outcome !== "failed") refresh();
    const transferId = result.metadata?.transferId;
    return {
      text: result.text,
      metadata: result.metadata,
      artifacts: result.artifacts,
      outcome: result.outcome,
      undo:
        typeof transferId === "string"
          ? once(async () => {
              const ok = await del(`/api/transfers/${transferId}`);
              refresh();
              return ok;
            })
          : undefined,
    };
  }

  if (action.type === "recordDebt") {
    const result = await executeRecordDebt(action);
    const refresh = () => queryClient.invalidateQueries({ queryKey: debtKeys.all });
    if (result.outcome !== "failed") refresh();
    const debtId = result.metadata?.debtId;
    return {
      text: result.text,
      metadata: result.metadata,
      artifacts: result.artifacts,
      outcome: result.outcome,
      undo:
        typeof debtId === "string"
          ? once(async () => {
              const ok = await del(`/api/debts/${debtId}`);
              refresh();
              return ok;
            })
          : undefined,
    };
  }

  if (action.type === "shoppingGroupCreate") {
    const r = await createGroupAndMove(action.threadId, action.name, action.messageIds);
    queryClient.invalidateQueries({ queryKey: ["hub"] });
    if (!r.ok) return { text: `Couldn't create ${action.name}.`, outcome: "failed" };
    return {
      text: `${action.name} · created`,
      metadata: { groupId: r.groupId, messageIds: action.messageIds },
      artifacts: [eraArtifact("shopping_group", "created", r.groupId, action.name, { thread: action.threadId })],
      outcome: "done",
      undo: once(async () => {
        const ok = await moveShoppingItems(action.messageIds, action.previousGroupId).catch(() => false);
        queryClient.invalidateQueries({ queryKey: ["hub"] });
        return ok;
      }),
    };
  }

  if (action.type === "shoppingRemove") {
    const ok = await removeShoppingMessages(action.messageIds).catch(() => false);
    queryClient.invalidateQueries({ queryKey: ["hub"] });
    return ok
      ? {
          text: `Removed · ${action.label}`,
          outcome: "done",
          artifacts: shoppingArtifacts(action.messageIds, action.label.split(", "), "deleted"),
        }
      : { text: "Couldn't remove it.", outcome: "failed" };
  }

  if (action.type === "recurringCover") {
    const result = await executeCoverRecurring(action);
    if (result.outcome !== "failed") {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
      queryClient.invalidateQueries({ queryKey: qk.analytics() });
    }
    return {
      text: result.text,
      metadata: result.metadata,
      artifacts: result.artifacts,
      outcome: result.outcome,
      undo:
        result.outcome === "done"
          ? once(async () => {
              const ok = await undoCoverRecurring(action);
              queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
              return ok;
            })
          : undefined,
    };
  }

  if (action.type === "reminderSeries") {
    const result = await resolveReminderReschedule(action.itemId, action.title, action.whenText);
    if (result.ok === false) return { text: result.text, outcome: "failed" };
    queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
    const previous = result.metadata?.previousDueAt;
    return {
      text: result.text,
      metadata: result.metadata,
      artifacts: result.artifacts,
      outcome: "done",
      undo: typeof previous === "string" ? once(() => patchDueAt(action.itemId, previous, queryClient)) : undefined,
    };
  }

  if (action.type === "reminderSkip") {
    const result = await skipNextOccurrence(action.itemId, action.title);
    if (result.outcome !== "failed") queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
    return { text: result.text, metadata: result.metadata, artifacts: result.artifacts, outcome: result.outcome };
  }

  if (action.type === "reminderOccurrence") {
    const result = await postponeNextOccurrence(action.itemId, action.title, action.whenText);
    if (result.outcome !== "failed") queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
    // No demonstrated inverse for an occurrence exception → no Undo (plan §5).
    return { text: result.text, metadata: result.metadata, artifacts: result.artifacts, outcome: result.outcome };
  }

  // Destructive registry capability — today only reminder.delete, whose
  // inverse is the Recycle Bin restore (the item is soft-deleted).
  const capability = getCapability(action.capabilityId);
  if (!capability) return { text: "That didn't go through.", outcome: "failed" };
  const parsed = capability.slots.safeParse(action.slots);
  if (!parsed.success) return { text: "That didn't go through.", outcome: "failed" };
  const result = await capability.execute(parsed.data);
  if (result.ok === false) return { text: result.text, metadata: result.metadata, outcome: "failed" };

  queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
  const deletedItemId = result.metadata?.deletedItemId;
  return {
    text: result.text,
    metadata: result.metadata,
    artifacts: result.artifacts,
    outcome: "done",
    undo:
      action.capabilityId === "reminder.delete" && typeof deletedItemId === "string"
        ? once(async () => {
            const res = await safeFetch("/api/recycle-bin/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ module: "items", id: deletedItemId }),
              timeoutMs: 8_000,
            });
            queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
            return res.ok;
          })
        : undefined,
  };
}
