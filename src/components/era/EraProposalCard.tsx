"use client";

// src/components/era/EraProposalCard.tsx
// AI-proposed action (Slice 4) — nothing behind this card has been written
// yet; Confirm performs the source writes, Dismiss just clears it. Renders only while
// `activeProposal` is set — the manual-handoff pattern's one shipped kind.
//
// Variants:
//   inline   — HUB-86: the newest turn of the conversation (hub stage,
//              desktop panel, mobile sheet), so it never covers the thread.
//   embedded — legacy sheet placement (kept for callers outside the thread).
//   floating — mobile module views with the chat sheet closed: an action
//              awaiting confirmation stays reachable (voice can raise one).

import { motion } from "framer-motion";
import { useState } from "react";
import { useEraAskAI } from "@/features/era/useEraAskAI";
import { saveLexiconRule } from "@/features/era/useEraLexicon";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { EraActionPreview } from "./EraActionPreview";

export type EraCardVariant = "floating" | "embedded" | "inline";
const nativeTitles = {
  transfer: "Transfer", recordDebt: "Record debt", capability: "Apply action",
  reminderSeries: "Move series", reminderOccurrence: "Move occurrence",
  shoppingGroupCreate: "Create group", shoppingRemove: "Remove shopping items",
  reminderSkip: "Skip occurrence", recurringCover: "Link payment",
};
const nativeFields: Record<string, string> = {
  amount: "Amount", currency: "Currency", fromAccountId: "From ID", toAccountId: "To ID",
  fromName: "From", toName: "To", debtorName: "Person", notes: "Notes", itemId: "Item",
  title: "Title", whenText: "When", threadId: "List", name: "Name", messageIds: "Items",
  previousGroupId: "Was", label: "Items", paymentId: "Payment", transactionId: "Transaction",
  txDate: "Date", previousLastProcessed: "Last paid", previousNextDue: "Next due",
};

export function EraProposalCard({ variant = "floating" }: { variant?: EraCardVariant }) {
  const tc = useThemeClasses();
  const { activeProposal, confirmProposal, dismissProposal } = useEraAskAI();
  // HUB-80 — "Always" (plan §5: ☐ Always beside Confirm). Only offered when
  // the same choice was made before; saving happens on Confirm, never alone.
  const [always, setAlways] = useState(false);
  if (!activeProposal) return null;
  const offer = activeProposal.kind === "native_action" ? activeProposal.offerAlways : undefined;
  const confirm = () => {
    if (offer && always) void saveLexiconRule({ kind: "default", ...offer });
    setAlways(false);
    void confirmProposal();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={
        variant === "inline"
          ? "mt-4"
          : variant === "embedded"
            ? "flex justify-center px-3 pb-2"
            : "absolute inset-x-0 z-[25] flex justify-center px-5 bottom-[148px] md:bottom-[76px]"
      }
    >
      <div
        className={[
          "flex w-full flex-col gap-3 rounded-2xl px-4 py-3.5", tc.bgPage,
          variant === "inline" ? "" : "max-w-[560px]",
        ].join(" ")}
        style={{
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
        }}
      >
        {(activeProposal.kind === "propose_plan" || activeProposal.kind === "propose_action") ? <>
          <details className="min-w-0 break-words text-[13px] text-white/50"><summary className="min-h-10 cursor-pointer">Request</summary>{activeProposal.sourceText}</details>
          <EraActionPreview
            plan={activeProposal.kind === "propose_plan" ? activeProposal.plan : { steps: [{ id: "action", label: "Action", capabilityId: activeProposal.capabilityId, slots: activeProposal.slots }] }}
            consent={activeProposal.kind === "propose_plan" ? activeProposal.consent : undefined}
            completed={activeProposal.kind === "propose_plan" ? activeProposal.resume?.map(s => s.id) : undefined}
            referenceDate={activeProposal.requestContext?.referenceDate ?? new Date().toISOString()}
            timeZone={activeProposal.requestContext?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          />
        </> : activeProposal.kind === "propose_nfc_reminder" ? <dl className="space-y-1 break-words text-[13px] text-white/80">
          <dt className="text-[15px]">Create triggered reminder</dt>
          <dd>{activeProposal.reminderTitle}</dd><dd>{activeProposal.nfcTagLabel} · {activeProposal.targetState}</dd>
          <dd className="text-white/50 [overflow-wrap:anywhere]">{activeProposal.nfcTagId} · Dormant</dd>
          <dd className="text-white/50">Normal · Once · No timed alert</dd>
        </dl> : activeProposal.kind === "native_action" ? <>
          {activeProposal.action.type === "capability" ? <EraActionPreview
            plan={{ steps: [{ id: "action", label: "Action", capabilityId: activeProposal.action.capabilityId, slots: activeProposal.action.slots }] }}
            referenceDate={activeProposal.requestContext?.referenceDate ?? new Date().toISOString()}
            timeZone={activeProposal.requestContext?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          /> : <>
            <p className="text-[15px] text-white/90">{nativeTitles[activeProposal.action.type]}</p>
            <dl className="space-y-1 break-words text-[13px] text-white/80">{Object.entries(activeProposal.action).filter(([key]) => key !== "type").map(([key, value]) => <div key={key} className="[overflow-wrap:anywhere]"><dt className="text-white/40">{nativeFields[key]}</dt><dd>{Array.isArray(value) ? value.length : String(value ?? "None")}</dd></div>)}</dl>
          </>}
        </> : <p className="text-[15px] leading-relaxed text-white/90">{activeProposal.text}</p>}
        {activeProposal.kind === "handoff" ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={dismissProposal}
              className="rounded-full px-3.5 py-2 text-[13px] text-white/60 transition-opacity hover:opacity-80"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={confirmProposal}
              className="rounded-full px-4 py-2 text-[13px] font-medium"
              style={{ background: "var(--era-accent, white)", color: "#0d1220" }}
            >
              Open
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {offer && (
              <button
                type="button"
                aria-pressed={always}
                onClick={() => setAlways((v) => !v)}
                className="mr-auto rounded-full border px-3.5 py-2 text-[13px] transition-opacity hover:opacity-80"
                style={{
                  borderColor: "var(--era-border-subtle, rgba(255,255,255,0.2))",
                  color: always ? "var(--era-accent)" : "rgba(255,255,255,0.6)",
                }}
              >
                {always ? "✓ Always" : "Always"}
              </button>
            )}
            <button
              type="button"
              onClick={dismissProposal}
              className="rounded-full px-3.5 py-2 text-[13px] text-white/60 transition-opacity hover:opacity-80"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-full px-4 py-2 text-[13px] font-medium"
              style={{ background: "var(--era-accent, white)", color: "#0d1220" }}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
