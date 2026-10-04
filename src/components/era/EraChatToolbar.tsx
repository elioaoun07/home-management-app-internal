"use client";

// src/components/era/EraChatToolbar.tsx
// HUB-52 / HUB-86 — two quiet controls in the ERA hub, flanking the orb:
// History (left) and New chat (right). New chat appears only when there is a
// conversation to leave; once it has gone quiet (30 min — when "it" stops
// resolving) a small dot suggests starting fresh, without forcing it.
// Icons only (Hard Rule #28); the names live in aria-label / title.

import type { ReactNode } from "react";
import { isQuiet, visibleMessages } from "@/features/era/thread";
import {
  useActiveEraConversation,
  useEraMessages,
  useStartNewEraChat,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useMinuteClock } from "./EraConversation";

/** Futuristic duotone icons: white strokes + an accent-colored detail. */
export function EraHistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.2 12a7.8 7.8 0 1 0 2.4-5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M4 3.8v3.4h3.4" stroke="var(--era-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.2l2.8 1.8" stroke="var(--era-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function EraNewChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 12.5V15a3 3 0 0 1-3 3h-5.5L7.5 21v-3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 3.5v5M15.5 6h5" stroke="var(--era-accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
      className="pointer-events-auto group relative flex size-10 items-center justify-center overflow-hidden rounded-2xl text-white/75 transition-all duration-200 active:scale-90 hover:text-white"
      style={{
        background:
          "linear-gradient(155deg, hsl(var(--era-hue) var(--era-sat) var(--era-lum) / 0.20) 0%, hsl(var(--era-hue) var(--era-sat) var(--era-lum) / 0.05) 100%)",
        border: "1px solid hsl(var(--era-hue) var(--era-sat) var(--era-lum) / 0.30)",
        boxShadow:
          "0 4px 14px hsl(var(--era-hue) 70% 35% / 0.22), inset 0 1px 0 rgba(255,255,255,0.14)",
        backdropFilter: "blur(10px)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ boxShadow: "inset 0 0 14px hsl(var(--era-hue) var(--era-sat) var(--era-lum) / 0.35)" }}
      />
      <span className="relative">{children}</span>
      {dot && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 size-2 rounded-full"
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
        <EraHistoryIcon className="size-5" />
      </ChatIconButton>
      {hasTurns && (
        <ChatIconButton label="New chat" onClick={startNewChat} dot={quiet}>
          <EraNewChatIcon className="size-5" />
        </ChatIconButton>
      )}
    </div>
  );
}
