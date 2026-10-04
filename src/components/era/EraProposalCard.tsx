"use client";

// src/components/era/EraProposalCard.tsx
// AI-proposed action (Slice 4) — nothing behind this card has been written
// yet; Confirm performs the real writes (POST /api/items, POST
// .../prerequisites), Dismiss just clears it. Renders only while
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

export type EraCardVariant = "floating" | "embedded" | "inline";

export function EraProposalCard({ variant = "floating" }: { variant?: EraCardVariant }) {
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
          "flex w-full flex-col gap-3 rounded-2xl px-4 py-3.5",
          variant === "inline" ? "" : "max-w-[560px]",
        ].join(" ")}
        style={{
          background: "#121a2c",
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
        }}
      >
        <p className="text-[15px] leading-relaxed text-white/90">{activeProposal.text}</p>
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
