"use client";

// src/components/era/EraChatToolbar.tsx
// HUB-52 / HUB-86 — two quiet controls in the ERA hub, flanking the orb:
// History (left) and New chat (right). New chat appears only when there is a
// conversation to leave; once it has gone quiet (30 min — when "it" stops
// resolving) a small dot suggests starting fresh, without forcing it.
// Icons only (Hard Rule #28); the names live in aria-label / title.

import { History, SquarePen } from "lucide-react";
import type { ReactNode } from "react";
import { isQuiet, visibleMessages } from "@/features/era/thread";
import {
  useActiveEraConversation,
  useEraMessages,
  useStartNewEraChat,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useMinuteClock } from "./EraConversation";

export function ChatIconButton({
  label,
  onClick,
  dot = false,
  children,
}: {
  label: string;
  onClick: () => void;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pointer-events-auto relative flex size-10 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85"
    >
      {children}
      {dot && (
        <span
          aria-hidden
          className="absolute right-2 top-2 size-1.5 rounded-full"
          style={{ background: "var(--era-accent)", boxShadow: "0 0 6px var(--era-accent)" }}
        />
      )}
    </button>
  );
}

/** Whether the active conversation has turns, and whether it has gone quiet. */
export function useActiveThreadState() {
  const { data: active } = useActiveEraConversation();
  const { data } = useEraMessages(active?.id ?? null);
  const now = useMinuteClock();
  const messages = data?.messages ?? [];
  const hasTurns = visibleMessages(messages).length > 0;
  return { hasTurns, quiet: hasTurns && isQuiet(messages, now) };
}

export function EraChatToolbar() {
  const isAwake = useEraStore((s) => s.isAwake);
  const isHub = useEraStore((s) => s.activeView === "hub");
  const setHistoryOpen = useEraStore((s) => s.setHistoryOpen);
  const startNewChat = useStartNewEraChat();
  const { hasTurns, quiet } = useActiveThreadState();

  if (!isAwake || !isHub) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center justify-between px-2 md:px-4"
      style={{ top: 56 }}
    >
      <ChatIconButton label="History" onClick={() => setHistoryOpen(true)}>
        <History className="size-[18px]" aria-hidden />
      </ChatIconButton>
      {hasTurns && (
        <ChatIconButton label="New chat" onClick={startNewChat} dot={quiet}>
          <SquarePen className="size-[18px]" aria-hidden />
        </ChatIconButton>
      )}
    </div>
  );
}
