"use client";

// src/components/era/EraHistorySheet.tsx
// HUB-52 — past ERA chats, kept out of the way: a side panel on desktop, a
// bottom sheet on phones, opened from the History control. Rows are grouped
// Today / Yesterday / This week / Earlier and titled from each chat's first
// sentence (deterministic — see conversationTitle). Tapping a row previews it
// read-only (Hard Rule #2: single tap = detail); Continue makes it the active
// chat with a clean context, Archive hides it (Undo on the toast).
//
// Retention: every chat stays in era_messages; History lists the 50 most
// recent, and a chat auto-closes after 6 h of silence (pickActiveConversation).
// Opaque surface (Hard Rule #15). Stays mounted and animates on `open`, like
// EraChatDrawer, so the preview's re-renders can't strand an exit animation.

import { motion } from "framer-motion";
import { Archive, ChevronLeft, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { historyGroup, historyStamp, type HistoryGroup } from "@/features/era/thread";
import {
  useActiveEraConversation,
  useArchiveEraConversation,
  useEraConversationHistory,
  useResumeEraConversation,
  type EraConversationSummary,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { EraConversation, useMinuteClock } from "./EraConversation";

const GROUP_ORDER: HistoryGroup[] = ["Today", "Yesterday", "This week", "Earlier"];
const SURFACE = "#0f1626";
const EDGE = "1px solid var(--era-border-subtle, rgba(255,255,255,0.12))";

export function EraHistorySheet() {
  const open = useEraStore((s) => s.historyOpen);
  const setOpen = useEraStore((s) => s.setHistoryOpen);
  const isMobile = useIsMobile();
  const now = useMinuteClock();
  const { data, isLoading, isError, refetch } = useEraConversationHistory(open);
  const { data: active } = useActiveEraConversation();
  const resume = useResumeEraConversation();
  const archive = useArchiveEraConversation();
  const [preview, setPreview] = useState<EraConversationSummary | null>(null);

  // Closing always lands back on the list next time.
  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  // Mount only once History has been opened (and the breakpoint is known):
  // a closed sheet mounting on wake-up flashed across the screen, and
  // useIsMobile is undefined on the first render, so it started as the
  // desktop side panel and then jumped to the phone sheet.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (open) setOpened(true);
  }, [open]);

  const groups = useMemo(() => {
    const byGroup = new Map<HistoryGroup, EraConversationSummary[]>();
    for (const c of data ?? []) {
      const g = historyGroup(Date.parse(c.updated_at), now);
      byGroup.set(g, [...(byGroup.get(g) ?? []), c]);
    }
    return GROUP_ORDER.flatMap((g) => (byGroup.has(g) ? [{ group: g, rows: byGroup.get(g)! }] : []));
  }, [data, now]);

  const close = () => setOpen(false);
  const pick = (c: EraConversationSummary) => {
    if (c.id === active?.id) close();
    else setPreview(c);
  };
  const continueChat = (c: EraConversationSummary) => {
    resume.mutate(c);
    close();
  };
  const archiveChat = (c: EraConversationSummary) => {
    archive.mutate(c);
    setPreview(null);
  };

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        {preview ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setPreview(null)}
            className="flex size-9 items-center justify-center rounded-full text-white/55 transition-colors hover:text-white/85"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate px-1 text-[15px] font-semibold text-white/85">
          {preview ? preview.title : "History"}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="flex size-9 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white/85"
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      </div>

      {preview ? (
        <>
          <div className="min-h-0 flex-1">
            <EraConversation layout="preview" conversationId={preview.id} />
          </div>
          <div
            className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 pt-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => archiveChat(preview)}
              disabled={archive.isPending}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-white/55 transition-colors hover:text-white/85 disabled:opacity-40"
            >
              <Archive className="size-4" aria-hidden />
              Archive
            </button>
            <button
              type="button"
              onClick={() => continueChat(preview)}
              disabled={resume.isPending}
              className="rounded-full px-4 py-2 text-[13px] font-medium disabled:opacity-40"
              style={{ background: "var(--era-accent, white)", color: "#0d1220" }}
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {isLoading && (
            <div className="space-y-2 px-3 pt-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded-md bg-white/[0.06]" />
              ))}
            </div>
          )}
          {isError && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="mx-3 mt-3 text-[13px] text-white/55 underline-offset-2 hover:underline"
            >
              Retry
            </button>
          )}
          {!isLoading && !isError && groups.length === 0 && (
            <p className="px-3 pt-3 text-[13px] text-white/40">No chats yet</p>
          )}
          {groups.map(({ group, rows }) => (
            <section key={group} aria-label={group}>
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                {group}
              </p>
              {rows.map((c) => {
                const current = c.id === active?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    aria-current={current ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] text-white/85">{c.title}</span>
                    <span className="shrink-0 text-[12px] text-white/35">
                      {historyStamp(Date.parse(c.updated_at), now)}
                    </span>
                    {current && (
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--era-accent)" }}
                      />
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );

  if (!opened || isMobile === undefined) return null;

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[60] bg-black/55"
        style={{ pointerEvents: open ? "auto" : "none" }}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="History"
        aria-hidden={!open}
        inert={!open}
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-[61] flex h-[78vh] flex-col rounded-t-3xl"
            : "fixed bottom-0 left-0 top-0 z-[61] flex w-[380px] flex-col"
        }
        style={{
          background: SURFACE,
          // Longhands only — mixing `border` with a side override makes React
          // rewrite both on every render.
          borderTop: isMobile ? EDGE : "none",
          borderRight: EDGE,
          borderLeft: isMobile ? EDGE : "none",
          borderBottom: "none",
          pointerEvents: open ? "auto" : "none",
        }}
        initial={false}
        animate={
          isMobile
            ? { x: 0, y: open ? 0 : "100%" }
            : { y: 0, x: open ? 0 : "-100%" }
        }
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {isMobile && <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15" />}
        {panel}
      </motion.div>
    </>
  );
}
