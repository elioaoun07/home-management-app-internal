"use client";

// src/components/era/EraChatDrawer.tsx
// Mobile-only chat bubble + bottom sheet for ERA's module/activity dashboard
// views. Hub view keeps the floating CommandBar/transcript (see EraShell) —
// this only covers the case where those would otherwise sit permanently on
// top of a dashboard the user is trying to read. Reuses CommandBar and
// EraThreadTranscript in "embedded" mode so mic/send/AI/transcript logic
// isn't duplicated (see their variant props).
//
// HUB-86 — the sheet holds the same conversation as the hub (EraConversation,
// "sheet" layout: confirm card and chips are its newest turn) and the same
// History / New chat controls in its header.

import { motion } from "framer-motion";
import { History, MessageCircle, SquarePen, X } from "lucide-react";
import { useStartNewEraChat } from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { CommandBar } from "./CommandBar";
import { ChatIconButton, useActiveThreadState } from "./EraChatToolbar";
import { EraConversation } from "./EraConversation";

export function EraChatDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setHistoryOpen = useEraStore((s) => s.setHistoryOpen);
  const startNewChat = useStartNewEraChat();
  const { hasTurns, quiet } = useActiveThreadState();

  return (
    <>
      <button
        type="button"
        aria-label="Open chat with ERA"
        onClick={() => onOpenChange(true)}
        className="fixed right-4 bottom-24 z-30 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full md:hidden"
        style={{
          background: `linear-gradient(155deg, hsl(var(--era-hue) var(--era-sat) calc(var(--era-lum) + 16%)) 0%, hsl(var(--era-hue) var(--era-sat) var(--era-lum)) 55%, hsl(var(--era-hue) calc(var(--era-sat) + 8%) calc(var(--era-lum) - 14%)) 100%)`,
          color: "#0d1220",
          boxShadow:
            "0 6px 16px hsla(var(--era-hue), 70%, 35%, 0.45), inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -3px 5px rgba(0,0,0,0.25)",
        }}
      >
        {/* Specular highlight — glossy sheen across the top of the bubble */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.12) 32%, rgba(255,255,255,0) 55%)",
          }}
        />
        <MessageCircle className="relative z-10 size-5" aria-hidden />
      </button>

      {/* Backdrop + sheet stay mounted and animate via `open` directly
          (opacity/y + pointer-events), rather than mounting/unmounting
          through AnimatePresence — the embedded transcript below keeps
          re-rendering (realtime messages, typewriter interval) even while
          closing, which was interfering with AnimatePresence's exit-complete
          tracking and left the sheet stuck off-screen but never removed. */}
      <motion.div
        aria-hidden={!open}
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        style={{ pointerEvents: open ? "auto" : "none" }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => onOpenChange(false)}
      />

      <motion.div
        aria-hidden={!open}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-3xl md:hidden"
        style={{
          background: "rgba(13, 18, 32, 0.97)",
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
          borderBottom: "none",
          pointerEvents: open ? "auto" : "none",
        }}
        animate={{ y: open ? 0 : "100%" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-center gap-1 px-2 pt-2 pb-1">
          <ChatIconButton label="History" onClick={() => setHistoryOpen(true)}>
            <History className="size-[18px]" aria-hidden />
          </ChatIconButton>
          <span className="flex-1 text-center text-xs font-semibold tracking-wide text-white/60">
            Talk to ERA
          </span>
          {hasTurns && (
            <ChatIconButton label="New chat" onClick={startNewChat} dot={quiet}>
              <SquarePen className="size-[18px]" aria-hidden />
            </ChatIconButton>
          )}
          <ChatIconButton label="Close chat" onClick={() => onOpenChange(false)}>
            <X className="size-[18px]" aria-hidden />
          </ChatIconButton>
        </div>

        {/* HUB-76 — the confirm card and chips render as the thread's newest turn. */}
        <div className="min-h-0 flex-1">
          <EraConversation layout="sheet" />
        </div>

        <div className="p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <CommandBar variant="embedded" />
        </div>
      </motion.div>
    </>
  );
}
