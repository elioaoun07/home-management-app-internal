"use client";

// src/components/era/EraReportCard.tsx
// HUB-85 — the Report card: pick what went wrong, optionally say what was
// expected, send. Opens from the "Report" chip ERA offers under a missed
// reply, or from any ERA message's details. The server snapshots the
// transcript and actions (src/lib/era/issueReport.ts); Undo is on the toast.
// Hard Rule #28: a title, two chips, one field, one verb.

import { Flag, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useReportEraIssue } from "@/features/era/useEraIssues";
import { useEraStore } from "@/features/era/useEraStore";

const KINDS = [
  { id: "missed", label: "Missed" },
  { id: "wrong", label: "Wrong" },
] as const;

export function EraReportCard({ conversationId }: { conversationId: string | null }) {
  const target = useEraStore((s) => s.reportTarget);
  const setTarget = useEraStore((s) => s.setReportTarget);
  const report = useReportEraIssue();
  const [note, setNote] = useState("");

  if (!target) return null;

  const send = () => {
    if (!conversationId || report.isPending) return;
    report.mutate(
      { conversationId, messageId: target.messageId, kind: target.kind, note },
      { onSuccess: () => setNote("") },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mt-4 rounded-2xl px-4 py-3.5"
      style={{
        background: "#121a2c",
        border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
      }}
      role="group"
      aria-label="Report"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] font-medium text-white/85">
          <Flag className="size-4" style={{ color: "var(--era-accent)" }} aria-hidden />
          Report
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setTarget(null)}
          className="-mr-1 rounded-full p-1.5 text-white/45 transition-colors hover:text-white/80"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {KINDS.map((k) => {
          const on = target.kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={on}
              onClick={() => setTarget({ ...target, kind: k.id })}
              className="rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors"
              style={{
                borderColor: on ? "var(--era-accent)" : "rgba(255,255,255,0.14)",
                color: on ? "var(--era-accent)" : "rgba(255,255,255,0.6)",
                background: on ? "hsla(var(--era-hue), 60%, 50%, 0.12)" : "transparent",
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Expected…"
          aria-label="What you expected"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-white/90 outline-none placeholder:text-white/30 focus:border-white/25 md:text-[14px]"
        />
        <button
          type="submit"
          disabled={!conversationId || report.isPending}
          className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-40"
          style={{ background: "var(--era-accent, white)", color: "#0d1220" }}
        >
          Send
        </button>
      </form>
    </motion.div>
  );
}
