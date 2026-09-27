"use client";

// src/components/era/EraAskChips.tsx
// HUB-78 — the one-question chip row (plan §4 component 1, §5 examples):
//   Drawer → ? · $300    [Wallet] [Savings] [Other]
// A tap answers the open question structurally (never re-parsed). A `nav:`
// option opens the precision page instead. Additive: rendered next to the
// confirm card, floating in the shell and inside the mobile chat sheet.

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEraStore } from "@/features/era/useEraStore";
import { useEraTurn } from "@/features/era/useEraTurn";

export function EraAskChips({ variant = "floating" }: { variant?: "floating" | "embedded" }) {
  const pending = useEraStore((s) => s.pendingTurn);
  const setPendingTurn = useEraStore((s) => s.setPendingTurn);
  const { runTurn } = useEraTurn();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (pending?.kind !== "slot") return null;

  const choose = async (label: string, value: string) => {
    if (value.startsWith("nav:")) {
      setPendingTurn(null);
      router.push(value.slice(4));
      return;
    }
    setBusy(true);
    try {
      await runTurn(label, { chip: value });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={
        variant === "embedded"
          ? "flex justify-center px-3 pb-2"
          : "absolute inset-x-0 z-25 flex justify-center px-5 bottom-[148px] md:bottom-[76px]"
      }
    >
      <div
        className="flex w-full max-w-[560px] flex-col gap-2 rounded-2xl px-4 py-3"
        style={{
          background: "rgba(13, 18, 32, 0.94)",
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
        }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--era-accent)" }}>
          {pending.question}
        </p>
        <div className="flex flex-wrap gap-2">
          {pending.options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              onClick={() => void choose(o.label, o.value)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium text-white/85 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ borderColor: "var(--era-border-subtle, rgba(255,255,255,0.2))" }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
