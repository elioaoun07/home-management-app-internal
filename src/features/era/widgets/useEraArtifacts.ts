"use client";

// ERA Artifacts data: which days have rows, one day's rows, each row's live
// status, and the persistent Undo/Redo. Undo/Redo is never re-implemented
// here — it calls the routes the manual app already uses (DELETE → soft-delete
// + balance reversal, Recycle Bin restore → un-delete + balance re-apply), so
// money moves exactly as it does when the owner taps those in the app.

import { catalogueKeys } from "@/features/catalogue/queryKeys";
import { transferKeys } from "@/features/transfers/hooks";
import {
  type EraArtifactAction,
  type EraBinModule,
  type EraReversal,
  eraArtifactReversal,
} from "@/lib/era/artifacts";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { formatDate } from "@/lib/utils/date";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eraKeys } from "../queryKeys";

export interface EraArtifactRow {
  id: string;
  action: EraArtifactAction;
  /** An ERA_ARTIFACT_ENTITIES key (src/lib/era/artifacts.ts). */
  entity_type: string;
  entity_id: string | null;
  title: string;
  route: string;
  created_at: string;
}

export type EraRowStatus = "live" | "trashed" | "changed" | "gone";

/** Local-calendar day key (yyyy-MM-dd) of an instant — days are the owner's, not UTC's. */
export const dayKeyOf = (iso: string): string => formatDate(new Date(iso));

/** Parse a yyyy-MM-dd key as a LOCAL date (never `new Date("yyyy-MM-dd")`, which is UTC). */
export function dateOfDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayBounds(key: string): { from: string; to: string } {
  const start = dateOfDayKey(key);
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { from: start.toISOString(), to: next.toISOString() };
}

/** Newest-first list of local days that have at least one artifact. */
export function useEraArtifactDays() {
  return useQuery({
    queryKey: eraKeys.artifacts.days(),
    queryFn: async (): Promise<string[]> => {
      const res = await safeFetch("/api/era/actions?view=days", { timeoutMs: 8_000 });
      if (!res.ok) throw new Error("Failed to load artifact days");
      const { days } = (await res.json()) as { days: string[] };
      return [...new Set(days.map(dayKeyOf))].sort().reverse();
    },
    staleTime: 15_000,
  });
}

export function useEraArtifactsForDay(dayKey: string | null) {
  return useQuery({
    queryKey: eraKeys.artifacts.day(dayKey ?? "none"),
    enabled: dayKey !== null,
    queryFn: async (): Promise<EraArtifactRow[]> => {
      const { from, to } = dayBounds(dayKey as string);
      const res = await safeFetch(
        `/api/era/actions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { timeoutMs: 8_000 },
      );
      if (!res.ok) throw new Error("Failed to load artifacts");
      const { actions } = (await res.json()) as { actions: EraArtifactRow[] };
      return actions;
    },
    staleTime: 15_000,
  });
}

/** The row an Undo/Redo acts on, or null when the row has no complete inverse. */
export const reversalOf = (row: EraArtifactRow): EraReversal | null =>
  eraArtifactReversal({ entity: row.entity_type, action: row.action, id: row.entity_id });

/** Live status of every reversible row's target, keyed by entity id. */
export function useEraRowStatus(rows: EraArtifactRow[]) {
  const targets = new Map<string, EraBinModule>();
  for (const row of rows) {
    const r = reversalOf(row);
    if (r) targets.set(r.id, r.bin);
  }
  const ids = [...targets.keys()].sort();
  return useQuery({
    queryKey: eraKeys.artifacts.status(ids),
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, EraRowStatus>> => {
      const res = await safeFetch("/api/era/actions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ids.map((id) => ({ bin: targets.get(id), id })) }),
        timeoutMs: 8_000,
      });
      if (!res.ok) throw new Error("Failed to read row status");
      return ((await res.json()) as { status: Record<string, EraRowStatus> }).status;
    },
    staleTime: 5_000,
  });
}

export type ReversalOp = "trash" | "restore";

/**
 * What the button shows and does, from the row's live status. Undo takes the
 * row back to how it was before ERA acted; Redo repeats ERA's act.
 * Null → no button (updated verb, hard-deleted, confirmed draft, unknown).
 */
export function reversalButton(
  reversal: EraReversal | null,
  status: EraRowStatus | undefined,
): { op: ReversalOp; label: "Undo" | "Redo" } | null {
  if (!reversal) return null;
  if (status === "live") return { op: "trash", label: reversal.born === "live" ? "Undo" : "Redo" };
  if (status === "trashed") return { op: "restore", label: reversal.born === "trashed" ? "Undo" : "Redo" };
  return null;
}

const TRASH_URL: Record<EraBinModule, (id: string) => string> = {
  items: (id) => `/api/items/${id}`,
  catalogue: (id) => `/api/catalogue/items/${id}`,
  transfers: (id) => `/api/transfers/${id}`,
  drafts: (id) => `/api/drafts/${id}`,
};

async function runReversal(op: ReversalOp, bin: EraBinModule, id: string): Promise<boolean> {
  const res =
    op === "trash"
      ? await safeFetch(TRASH_URL[bin](id), { method: "DELETE", timeoutMs: 15_000 })
      : await safeFetch("/api/recycle-bin/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module: bin, id }),
          timeoutMs: 15_000,
        });
  return res.ok;
}

/** Refresh everything that shows the affected row, including balances. */
function invalidateAfter(qc: QueryClient, bin: EraBinModule) {
  qc.invalidateQueries({ queryKey: eraKeys.artifacts.all() });
  qc.invalidateQueries({ queryKey: ["recycle-bin"] });
  if (bin === "items") qc.invalidateQueries({ queryKey: qk.scheduleItems() });
  if (bin === "catalogue") qc.invalidateQueries({ queryKey: catalogueKeys.all });
  if (bin === "transfers") qc.invalidateQueries({ queryKey: transferKeys.all });
  if (bin === "drafts") qc.invalidateQueries({ queryKey: qk.drafts() });
  if (bin === "transfers" || bin === "drafts") {
    invalidateAccountData(qc);
    qc.invalidateQueries({ queryKey: ["account-balance"] });
  }
}

interface ReversalVars {
  reversal: EraReversal;
  op: ReversalOp;
  label: "Undo" | "Redo";
}

export function useArtifactReversal() {
  const qc = useQueryClient();

  const mutation = useMutation<void, Error, ReversalVars>({
    mutationFn: async ({ reversal, op }) => {
      if (!(await runReversal(op, reversal.bin, reversal.id))) throw new Error("reversal failed");
    },
    onSuccess: (_d, { reversal, op, label }) => {
      invalidateAfter(qc, reversal.bin);
      const back = label === "Undo" ? "Redo" : "Undo";
      toast.success(label === "Undo" ? "Undone" : "Redone", {
        icon: ToastIcons.update,
        duration: 4000,
        // The opposite move is the same row going the other way.
        action: {
          label: back,
          onClick: () => mutation.mutate({ reversal, op: op === "trash" ? "restore" : "trash", label: back }),
        },
      });
    },
    onError: (_e, { reversal, label }) => {
      // The row moved on (restored elsewhere, edited, confirmed): re-read it.
      invalidateAfter(qc, reversal.bin);
      toast.error(`Can't ${label.toLowerCase()}`, { icon: ToastIcons.error });
    },
  });

  return mutation;
}
