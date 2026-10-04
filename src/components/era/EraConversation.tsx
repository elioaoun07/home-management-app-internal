"use client";

// src/components/era/EraConversation.tsx
// HUB-86 — the ERA conversation, read like one. Replaces the 240 px monospace
// strip (EraThreadTranscript) with a real thread: the person's messages as
// bubbles in their own color (Hard Rule #14), ERA's replies as plain readable
// text beside a small orb in the hue of the face that answered, time breaks,
// ERA "thinking" while a turn resolves, the confirm card and question chips
// as the newest turn (so they never cover the thread), and — HUB-85 — a quiet
// "Report" offer under a reply that missed.
//
// Layouts:
//   stage   — the hub while a conversation is open (the orb has risen out of
//             the way; EraShell positions it between the orb and the bar)
//   panel   — desktop module dashboards: an opaque card above the bar
//   sheet   — inside the mobile chat sheet (EraChatDrawer)
//   preview — a past chat inside History: read-only, no live extras
//
// Everything about WHAT to show lives in src/features/era/thread.ts (tested);
// this file only renders it.

import { ArrowDown, Flag, SquarePen } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buildThread,
  defaultReportKind,
  isQuiet,
  reportOfferId,
  timeLabel,
  type ThreadMessage,
} from "@/features/era/thread";
import {
  useActiveEraConversation,
  useEraMessages,
  useEraMessagesRealtime,
  useStartNewEraChat,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { EraAskChips } from "./EraAskChips";
import { EraProposalCard } from "./EraProposalCard";
import { EraReportCard } from "./EraReportCard";
import { faceHue } from "./eraHues";

export type EraConversationLayout = "stage" | "panel" | "sheet" | "preview";

const EMPTY: ThreadMessage[] = [];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Re-renders once a minute so time breaks and the quiet nudge stay current. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Types out ERA's newest reply once, as it arrives. Whatever is already in the
 * thread when it loads is history and shows in full; an optimistic row being
 * swapped for its saved copy (same text, new id) never restarts.
 */
function useTypewriter(newest: { id: string; content: string } | null, enabled: boolean) {
  const seenIdRef = useRef<string | null | undefined>(undefined);
  const seenContentRef = useRef("");
  const [typing, setTyping] = useState<{ id: string; shown: string } | null>(null);
  const id = newest?.id ?? null;
  const content = newest?.content ?? "";

  useEffect(() => {
    if (!enabled) return;
    if (seenIdRef.current === undefined) {
      seenIdRef.current = id;
      seenContentRef.current = content;
      return;
    }
    if (!id || id === seenIdRef.current) return;
    seenIdRef.current = id;
    if (content === seenContentRef.current) return;
    seenContentRef.current = content;

    const step = Math.max(1, Math.ceil(content.length / 90)); // ≤ ~1.5 s for any reply
    let shown = 0;
    setTyping({ id, shown: "" });
    const timer = setInterval(() => {
      shown = Math.min(content.length, shown + step);
      setTyping({ id, shown: content.slice(0, shown) });
      if (shown >= content.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [enabled, id, content]);

  return typing;
}

/** Enter/Space on a focusable message opens its details, like a tap. */
function activateOnKey(e: KeyboardEvent, run: () => void): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  run();
}

function lastAssistant(messages: readonly ThreadMessage[]): ThreadMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
}

/** ERA's avatar: a small orb in the hue of the face that answered. */
function OrbAvatar({ hue }: { hue: number | null }) {
  const h = hue === null ? "var(--era-hue)" : String(hue);
  return (
    <span
      aria-hidden
      className="mt-[3px] block size-[18px] rounded-full"
      style={{
        background: `radial-gradient(circle at 50% 42%, hsl(${h} 95% 84%) 0%, hsl(${h} 85% 62%) 36%, hsla(${h}, 80%, 45%, 0.3) 66%, transparent 72%)`,
        boxShadow: `0 0 12px hsla(${h}, 85%, 60%, 0.35)`,
      }}
    />
  );
}

function Thinking() {
  return (
    <div className="mt-4 flex gap-2.5" role="status" aria-label="ERA is thinking">
      <div className="w-[18px] shrink-0">
        <OrbAvatar hue={null} />
      </div>
      <div className="flex h-6 items-center gap-1.5">
        <span className="era-think-dot" />
        <span className="era-think-dot" />
        <span className="era-think-dot" />
      </div>
    </div>
  );
}

export function EraConversation({
  layout,
  conversationId: previewId = null,
}: {
  layout: EraConversationLayout;
  /** preview only — the past chat to show. */
  conversationId?: string | null;
}) {
  const live = layout !== "preview";
  const { data: active } = useActiveEraConversation();
  const conversationId = live ? (active?.id ?? null) : previewId;
  const { data, isSuccess } = useEraMessages(conversationId);
  useEraMessagesRealtime(live ? conversationId : null);
  const messages: ThreadMessage[] = data?.messages ?? EMPTY;

  const now = useMinuteClock();
  const items = useMemo(() => buildThread(messages, now), [messages, now]);

  const turnInFlight = useEraStore((s) => s.turnInFlight);
  const askingAI = useEraStore((s) => s.askingAI);
  const reportTarget = useEraStore((s) => s.reportTarget);
  const setReportTarget = useEraStore((s) => s.setReportTarget);
  const hasProposal = useEraStore((s) => s.activeProposal !== null);
  const hasQuestion = useEraStore((s) => s.pendingTurn?.kind === "slot");
  const startNewChat = useStartNewEraChat();
  const { theme } = useTheme();
  const mine = theme === "pink" ? "pink" : "blue"; // Hard Rule #14 — the person's own color

  const thinking = live && (turnInFlight || askingAI);
  const offerId = live && !thinking && !reportTarget ? reportOfferId(messages) : null;
  const quiet =
    live && !thinking && !reportTarget && !hasProposal && !hasQuestion && isQuiet(messages, now);
  const typing = useTypewriter(live ? lastAssistant(messages) : null, live && isSuccess);
  const [openId, setOpenId] = useState<string | null>(null);

  // ── Scroll: stay on the newest turn unless the person scrolled up ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);
  const scrollToEnd = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    if (atEnd !== pinnedRef.current) {
      pinnedRef.current = atEnd;
      setPinned(atEnd);
    }
  };
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToEnd();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToEnd]);
  const last = messages[messages.length - 1];
  useEffect(() => {
    // Your own new message always brings the thread back to the end.
    if (last?.role !== "user") return;
    pinnedRef.current = true;
    setPinned(true);
    scrollToEnd();
  }, [last?.id, last?.role, scrollToEnd]);
  useIsoLayoutEffect(() => {
    pinnedRef.current = true;
    setPinned(true);
    scrollToEnd();
  }, [conversationId, scrollToEnd]);

  const openReport = (messageId: string) => {
    setOpenId(null);
    setReportTarget({ messageId, kind: defaultReportKind(messages, messageId) });
  };

  const body: ReactNode = (
    <>
      {items.map((item, i) => {
        const prev = items[i - 1];
        const gap = !prev
          ? ""
          : item.type === "break"
            ? "mt-6"
            : prev.type === "break"
              ? "mt-2"
              : (item.type === "assistant" && !item.first) ||
                  (item.type === "user" && prev.type === "user")
                ? "mt-1.5"
                : "mt-4";

        if (item.type === "break") {
          return (
            <div key={item.key} className={`${gap} text-center text-[11px] font-medium tracking-wide text-white/35`}>
              {item.label}
            </div>
          );
        }

        if (item.type === "report") {
          return (
            <div key={item.key} className={`${gap} flex justify-center`}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/45">
                <Flag className="size-3" aria-hidden />
                Reported
              </span>
            </div>
          );
        }

        const m = item.message;
        const at = Date.parse(m.created_at);
        const open = openId === m.id;
        const toggle = () => setOpenId(open ? null : m.id);

        if (item.type === "user") {
          return (
            <div key={item.key} className={`${gap} flex flex-col items-end`}>
              <div
                role="button"
                tabIndex={0}
                onClick={toggle}
                aria-expanded={open}
                onKeyDown={(e) => activateOnKey(e, toggle)}
                className={[
                  "max-w-[85%] cursor-default whitespace-pre-wrap break-words rounded-[20px] rounded-br-md border px-3.5 py-2 text-[15px] leading-relaxed text-white/95 md:max-w-[75%]",
                  mine === "pink"
                    ? "border-pink-400/25 bg-pink-500/20"
                    : "border-blue-400/25 bg-blue-500/20",
                ].join(" ")}
              >
                {m.content}
              </div>
              {open && Number.isFinite(at) && (
                <span className="mt-1 text-[11px] text-white/35">{timeLabel(at)}</span>
              )}
            </div>
          );
        }

        const isTyping = typing?.id === m.id && typing.shown.length < m.content.length;
        return (
          <div key={item.key} className={`${gap} flex gap-2.5`}>
            <div className="w-[18px] shrink-0">{item.first && <OrbAvatar hue={faceHue(m.intent_face)} />}</div>
            <div className="min-w-0 flex-1">
              <div
                role="button"
                tabIndex={0}
                onClick={toggle}
                aria-expanded={open}
                onKeyDown={(e) => activateOnKey(e, toggle)}
                className="cursor-default whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90 md:text-base"
              >
                {isTyping ? typing.shown : m.content}
                {isTyping && (
                  <span
                    aria-hidden
                    className="ml-[2px] inline-block h-[15px] w-[2px] animate-pulse align-middle"
                    style={{ backgroundColor: "var(--era-accent)" }}
                  />
                )}
              </div>
              {m.id === offerId && !open && (
                <button
                  type="button"
                  onClick={() => openReport(m.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[12px] text-white/50 transition-colors hover:border-white/25 hover:text-white/80"
                >
                  <Flag className="size-3" aria-hidden />
                  Report
                </button>
              )}
              {open && (
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/35">
                  {Number.isFinite(at) && <span>{timeLabel(at)}</span>}
                  {live && !m.id.startsWith("optimistic-") && (
                    <button
                      type="button"
                      onClick={() => openReport(m.id)}
                      className="inline-flex items-center gap-1 text-white/50 transition-colors hover:text-white/85"
                    >
                      <Flag className="size-3" aria-hidden />
                      Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {thinking && <Thinking />}

      {live && (
        <>
          <EraProposalCard variant="inline" />
          <EraAskChips variant="inline" />
          <EraReportCard conversationId={active && !active.local ? active.id : null} />
        </>
      )}

      {quiet && (
        <div className="mt-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/55 transition-colors hover:border-white/25 hover:text-white/85"
          >
            <SquarePen className="size-3.5" aria-hidden />
            New chat
          </button>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}
    </>
  );

  const jump = !pinned && (
    <button
      type="button"
      aria-label="Latest"
      onClick={() => {
        pinnedRef.current = true;
        setPinned(true);
        scrollToEnd(true);
      }}
      className="absolute bottom-3 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/12 text-white/70 shadow-lg transition-colors hover:text-white"
      style={{ background: "#121a2c" }}
    >
      <ArrowDown className="size-4" aria-hidden />
    </button>
  );

  const log = {
    ref: contentRef,
    role: "log" as const,
    "aria-live": live ? ("polite" as const) : undefined,
    "aria-label": "Conversation with ERA",
  };

  if (layout === "stage") {
    return (
      <div className="relative h-full">
        <div ref={scrollRef} onScroll={onScroll} className="era-thread-fade h-full overflow-y-auto overscroll-contain">
          <div
            {...log}
            className="mx-auto flex min-h-full w-full max-w-[680px] flex-col justify-end px-4 pb-4 pt-10 xl:max-w-[min(680px,calc(94vw-728px))]"
          >
            {body}
          </div>
        </div>
        {jump}
      </div>
    );
  }

  if (layout === "panel") {
    if (items.length === 0 && !thinking) return null;
    return (
      <div
        className="relative flex max-h-[min(300px,40vh)] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "#101828", border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.1))" }}
      >
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <div {...log} className="flex flex-col">
            {body}
          </div>
        </div>
        {jump}
      </div>
    );
  }

  // sheet / preview
  return (
    <div className="relative h-full">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-4 py-2">
        <div {...log} className="flex min-h-full flex-col justify-end pb-2">
          {body}
        </div>
      </div>
      {jump}
    </div>
  );
}
