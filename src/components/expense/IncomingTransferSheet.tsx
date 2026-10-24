"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { transferKeys, type Transfer } from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

const ACK_KEY = "ack-incoming-transfers";
const RECENT_MS = 48 * 60 * 60 * 1000;
const POLL_MS = 60_000;

function readAcked(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAcked(ids: string[]) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* quota / blocked storage — sheet just reappears next load */
  }
}

async function fetchRecentTransfers(): Promise<Transfer[]> {
  const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const res = await fetch(`/api/transfers?start=${start}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Transfer[];
}

/**
 * Global bottom sheet shown when the household partner sends a transfer.
 * Acknowledge is remembered per device; Cancel hides it until next load.
 * Purely informational — balances were already updated server-side.
 */
export default function IncomingTransferSheet() {
  const tc = useThemeClasses();
  const [acked, setAcked] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => setAcked(readAcked()), []);

  const { data } = useQuery({
    queryKey: [...transferKeys.all, "incoming"] as const,
    queryFn: fetchRecentTransfers,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const cutoff = Date.now() - RECENT_MS;
  const pending = (data ?? [])
    .filter(
      (t) =>
        t.is_recipient &&
        !t.is_owner &&
        t.transfer_type === "household" &&
        new Date(t.created_at).getTime() >= cutoff &&
        !acked.includes(t.id) &&
        !dismissed.includes(t.id),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  const current = pending[0];

  const acknowledge = () => {
    if (!current) return;
    const next = [...acked, current.id];
    setAcked(next);
    writeAcked(next);
  };
  const cancel = () => {
    if (current) setDismissed((d) => [...d, current.id]);
  };

  if (!current) return null;

  const net = current.amount - (current.returned_amount || 0);
  const currency = current.to_account_currency || "USD";
  const border = tc.isFrost
    ? "border-slate-200/90"
    : tc.isCalm
      ? "border-stone-600/45"
      : "border-white/[0.08]";
  const main = tc.isFrost
    ? "text-slate-900"
    : tc.isCalm
      ? "text-stone-100"
      : "text-white/90";
  const soft = tc.isFrost
    ? "text-slate-600"
    : tc.isCalm
      ? "text-stone-400"
      : "text-white/60";
  const ghost = tc.isFrost
    ? "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
    : tc.isCalm
      ? "bg-stone-700/40 text-stone-300 hover:bg-stone-700"
      : "bg-white/5 text-white/70 hover:bg-white/10";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "left-0 top-auto bottom-0 max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-5 overflow-y-auto rounded-b-none rounded-t-3xl border p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6",
          tc.bgPage,
          border,
        )}
      >
        <div
          className={cn(
            "mx-auto -mt-2 h-1 w-9 rounded-full sm:hidden",
            tc.separatorBg,
          )}
          aria-hidden
        />
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border",
            tc.bgSurface,
            tc.border,
            tc.text,
          )}
        >
          <ArrowDownLeft className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <DialogTitle
            className={cn(
              "text-3xl font-semibold tabular-nums tracking-tight",
              main,
            )}
          >
            {net.toFixed(2)} {currency}
          </DialogTitle>
          <DialogDescription className={cn("mt-2 text-sm", soft)}>
            {current.to_account_name}
            {current.description ? ` · ${current.description}` : ""}
          </DialogDescription>
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <button
            type="button"
            onClick={cancel}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] motion-reduce:transform-none",
              ghost,
            )}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={acknowledge}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] motion-reduce:transform-none",
              tc.buttonPrimary,
              tc.textButton,
            )}
          >
            <Check className="h-4 w-4" />
            Acknowledge
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
