// src/features/era/logEraAction.ts
// Single place that turns a resolved ERA intent (or the NFC proposal
// confirm) into a row in era_actions, for the /era Activity card. Called
// from useEraTurn.runTurn and useEraAskAI.confirmProposal — never from
// inside a resolver, so this stays the one spot that knows the full mapping
// (see the plan doc "ERA Top View — Activity Log + Top-Left Icon Redesign").
//
// Fire-and-forget: a failed log write must never break the user-visible
// reply, so this never throws and callers don't await it.
import { safeFetch } from "@/lib/safeFetch";
import { formatDate } from "@/lib/utils/date";
import type { QueryClient } from "@tanstack/react-query";
import { eraKeys } from "./queryKeys";
import type { Intent } from "./types";

interface LogPayload {
  action: "created" | "updated";
  entity_type: "reminder" | "transaction" | "transfer" | "debt" | "meal_plan" | "memory";
  entity_id: string | null;
  title: string;
  route: string;
}

function buildPayload(
  kind: Intent["kind"],
  metadata: Record<string, unknown> | undefined,
): LogPayload | null {
  if (!metadata) return null;
  const m = metadata;

  switch (kind) {
    case "draftReminder": {
      const itemId = typeof m.itemId === "string" ? m.itemId : null;
      const title = typeof m.title === "string" ? m.title : null;
      if (!itemId || !title) return null; // "what time?" question turn, or draft-without-id
      // WebDayPlanner only loads one day's items at a time — send it to the
      // reminder's own date so the deep-link open actually finds the row.
      // No dueAt (saved as an undated draft) means no date param; the
      // detail modal still opens via the direct-fetch path in WebDayPlanner.
      const dueAt = typeof m.dueAt === "string" ? m.dueAt : null;
      const dateParam = dueAt ? `&date=${formatDate(new Date(dueAt))}` : "";
      return {
        action: "created",
        entity_type: "reminder",
        entity_id: itemId,
        title,
        route: `/items?openId=${itemId}${dateParam}`,
      };
    }

    case "confirmDraft": {
      const transactionId = typeof m.transactionId === "string" ? m.transactionId : null;
      if (!transactionId) return null;
      const amount = typeof m.amount === "number" ? m.amount : null;
      return {
        action: "updated",
        entity_type: "transaction",
        entity_id: transactionId,
        title: amount != null ? `Transaction confirmed — $${amount.toFixed(2)}` : "Transaction confirmed",
        // /dashboard (WebDashboard.tsx) is the actual transaction browse/edit
        // surface — /expense is entry-only, it has no detail view to open.
        route: `/dashboard?openId=${transactionId}`,
      };
    }

    case "draftTransaction": {
      const draftId = typeof m.draftId === "string" ? m.draftId : null;
      if (!draftId) return null; // failed draft (no account, parse failure, etc.)
      const amount = typeof m.amount === "number" ? m.amount : null;
      const category = typeof m.categoryName === "string" ? m.categoryName : "Expense";
      return {
        action: "created",
        entity_type: "transaction",
        entity_id: draftId,
        title: amount != null ? `${category} draft — $${amount.toFixed(2)}` : `${category} draft`,
        route: "/expense",
      };
    }

    case "transfer": {
      const transferId = typeof m.transferId === "string" ? m.transferId : null;
      if (!transferId) return null;
      const amount = typeof m.amount === "number" ? m.amount : null;
      const from = typeof m.fromName === "string" ? m.fromName : "account";
      const to = typeof m.toName === "string" ? m.toName : "account";
      return {
        action: "created",
        entity_type: "transfer",
        entity_id: transferId,
        title: amount != null ? `Transfer $${amount.toFixed(2)} — ${from} → ${to}` : `Transfer — ${from} → ${to}`,
        route: "/expense",
      };
    }

    case "recordDebt": {
      const debtId = typeof m.debtId === "string" ? m.debtId : null;
      if (!debtId) return null;
      const debtorName = typeof m.debtorName === "string" ? m.debtorName : "Debt";
      const amount = typeof m.amount === "number" ? m.amount : null;
      return {
        action: "created",
        entity_type: "debt",
        entity_id: debtId,
        title: amount != null ? `${debtorName} owes $${amount.toFixed(2)}` : `${debtorName} — debt recorded`,
        route: "/expense",
      };
    }

    case "assignMeal": {
      const mealPlanId = typeof m.mealPlanId === "string" ? m.mealPlanId : null;
      if (!mealPlanId) return null;
      const recipeName = typeof m.recipeName === "string" ? m.recipeName : "Meal";
      const mealType = typeof m.mealType === "string" ? m.mealType : "meal";
      return {
        action: "created",
        entity_type: "meal_plan",
        entity_id: mealPlanId,
        title: `${recipeName} — ${mealType}`,
        route: "/meal-plan",
      };
    }

    case "memorySave": {
      if (m.duplicate) return null; // rejected as a duplicate — nothing written
      const label = typeof m.label === "string" ? m.label : null;
      if (!label) return null;
      const memoryId = typeof m.memoryId === "string" ? m.memoryId : null;
      return {
        action: "created",
        entity_type: "memory",
        entity_id: memoryId,
        title: label,
        route: "/era?face=brain",
      };
    }

    default:
      return null;
  }
}

function post(payload: LogPayload, queryClient?: QueryClient): void {
  safeFetch("/api/era/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (res.ok) queryClient?.invalidateQueries({ queryKey: eraKeys.widgets.activity() });
    })
    .catch(() => {});
}

export function logEraAction(
  kind: Intent["kind"],
  metadata: Record<string, unknown> | undefined,
  queryClient?: QueryClient,
): void {
  const payload = buildPayload(kind, metadata);
  if (!payload) return;
  post(payload, queryClient);
}

/** Separate entry point — the NFC-trigger reminder proposal doesn't flow
 *  through resolveIntent, so it doesn't have an Intent["kind"] to switch on. */
export function logEraNfcReminder(itemId: string, title: string, queryClient?: QueryClient): void {
  post(
    {
      action: "created",
      entity_type: "reminder",
      entity_id: itemId,
      title,
      route: `/items?openId=${itemId}`,
    },
    queryClient,
  );
}
