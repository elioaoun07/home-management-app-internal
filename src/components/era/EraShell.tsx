"use client";

// ERA Shell — Agentic OS interface.
//
// The ERA DOT is always rendered and spring-animates between two positions:
//   hub mode     → full-size, vertically centered, chat hue (190°)
//   module mode  → small at top (scale 0.34), module hue, dashboard scrolls below
//
// Every color (glow, CommandBar border, icons, text accent) is driven by
// --era-hue / --era-accent CSS variables that shapeshift with the active module.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getFace } from "@/features/era/faceRegistry";
import { useEraAskAI } from "@/features/era/useEraAskAI";
import {
  useActiveEraConversation,
  useEraMessages,
  useEraMessagesRealtime,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useEraTurn } from "@/features/era/useEraTurn";
import { useEraWakeListener } from "@/features/era/useEraWakeListener";
import { useConversationMode } from "@/features/voice-conversation/hooks/useConversationMode";
import { unlockAudioContext } from "@/features/voice-conversation/audioContext";
import { preloadGreetings } from "@/features/voice-conversation/greetingCache";
import { ERAMark } from "@/components/shared/ERAMark";
import { useUser } from "@/contexts/UserContext";
import { BudgetDashboard } from "./dashboards/BudgetDashboard";
import { ScheduleDashboard } from "./dashboards/ScheduleDashboard";
import { ChefDashboard } from "./dashboards/ChefDashboard";
import { BrainDashboard } from "./dashboards/BrainDashboard";
import { CommandBar } from "./CommandBar";
import { EraDots } from "./EraDots";
import { EraFaceNav } from "./EraFaceNav";
import { HubScatterWidgets } from "./HubScatterWidgets";

// Module hues — "chat" is the ERA hub default (190°)
const MODULE_COLORS: Record<string, { hue: number; sat: number; lum: number }> = {
  chat:      { hue: 190, sat: 85, lum: 62 },
  financial: { hue: 175, sat: 72, lum: 55 },
  recipe:    { hue:  28, sat: 85, lum: 58 },
  schedule:  { hue: 256, sat: 78, lum: 68 },
  memory:    { hue: 220, sat: 65, lum: 68 },
  health:    { hue: 352, sat: 82, lum: 62 },
  home:      { hue: 205, sat: 75, lum: 62 },
  trip:      { hue: 155, sat: 72, lum: 58 },
  fitness:   { hue:  40, sat: 92, lum: 62 },
  outfit:    { hue: 325, sat: 78, lum: 68 },
};

// Heights used to centre the ERA DOT block in hub mode.
// The motion.div contains: greeting (~80px) + ring (500px) + label (~40px).
const RING_H       = 500;   // ring container height (desktop)
const HUB_BLOCK_H  = 622;   // greeting + ring + label + margins (approx)
const MODULE_SCALE = 0.34;  // ERA DOT scale in module mode

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardContent({ faceKey }: { faceKey: string }) {
  switch (faceKey) {
    case "budget":   return <BudgetDashboard />;
    case "schedule": return <ScheduleDashboard />;
    case "chef":     return <ChefDashboard />;
    case "brain":    return <BrainDashboard />;
    default:         return null;
  }
}

export function EraShell() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const activeView    = useEraStore((s) => s.activeView);
  const isAwake       = useEraStore((s) => s.isAwake);
  const wake          = useEraStore((s) => s.wake);
  const setEraReply   = useEraStore((s) => s.setEraReply);
  const user          = useUser();

  // The one entry point from "a sentence" to "a reply" — shared with
  // CommandBar so typed and voice input can never disagree (HUB-16).
  const { runTurn } = useEraTurn();

  const firstName = user?.name?.split(" ")[0] ?? "";
  const setVoiceReplyEnabled = useEraStore((s) => s.setVoiceReplyEnabled);

  // Unlock AudioContext on first user gesture — needed for voice-wake TTS to play.
  // Also pre-caches the 3 greeting variants for the current time of day so the
  // greeting plays from an AudioBuffer (~instant) instead of waiting for Azure fetch.
  const handleFirstInteraction = useCallback(() => {
    unlockAudioContext();
    preloadGreetings(firstName || undefined);
  }, [firstName]);

  useEffect(() => {
    document.addEventListener("pointerdown", handleFirstInteraction, { once: true });
    return () => document.removeEventListener("pointerdown", handleFirstInteraction);
  }, [handleFirstInteraction]);

  // Re-preload when name becomes available (e.g., initial render before user data loads).
  useEffect(() => {
    if (firstName) {
      preloadGreetings(firstName);
    }
  }, [firstName]);

  // Conversation engine — handles wake detection, TTS greeting, and voice Q&A.
  const { wake: engineWake, isEnabled: convModeEnabled } = useConversationMode({
    enabled: true,
    userName: firstName || undefined,
    onWake: (source) => {
      wake();
      // Voice wake auto-enables the speaker so ERA speaks back.
      // Click/tap wake leaves the speaker in whatever state the user set.
      if (source === "speech") setVoiceReplyEnabled(true);
    },
    handlers: {
      onWillSpeak: (text) => setEraReply(text),
      // Same brain as the command bar — see useEraTurn. The engine only
      // inspects `kind` to decide whether to offer the AI dig-deeper prompt.
      runTurn: async (text) => {
        const { reply, intent } = await runTurn(text);
        return { reply, kind: intent.kind };
      },
      sessionId: undefined,
    },
  });

  // Fallback wake listener — only runs when conversation engine is not supported
  useEraWakeListener({ enabled: !convModeEnabled });

  const hubModuleKey = useEraStore((s) => s.hubModuleKey);
  const face      = getFace(activeFaceKey);
  // Hub → tracks last mentioned module (starts as "chat", shifts when user addresses a face);
  // Module dashboard → that face's module key.
  const moduleKey = activeView === "hub" ? hubModuleKey : face.eraModuleKey;
  const fc        = MODULE_COLORS[moduleKey] ?? MODULE_COLORS.chat;
  const isHub     = activeView === "hub";

  const greeting  = `${getTimeGreeting()}${firstName ? `, ${firstName}.` : "."}`;

  // Measure the content area so we can spring the ERA DOT to an exact pixel center.
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight - 52 : 800,
  );
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentH(el.clientHeight));
    ro.observe(el);
    setContentH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // ERA DOT top-offset in hub mode: centres the entire greeting+ring+label block
  const hubDotTop     = Math.max(0, (contentH - HUB_BLOCK_H) / 2);
  // ERA DOT top-offset in module mode: sits just below the nav
  const moduleDotTop  = 8;
  // Dashboard starts below the shrunk ERA DOT + gap
  const dashboardTop  = Math.round(moduleDotTop + RING_H * MODULE_SCALE + 20);

  return (
    <div
      className="era-shell fixed inset-0 overflow-hidden"
      data-awake={isAwake}
      onClick={!isAwake ? () => { unlockAudioContext(); preloadGreetings(firstName || undefined); wake(); engineWake(); } : undefined}
      style={
        {
          "--era-hue":           fc.hue,
          "--era-sat":           isAwake ? `${fc.sat}%`  : "0%",
          "--era-lum":           isAwake ? `${fc.lum}%`  : "18%",
          "--era-accent":        `hsl(${fc.hue}, ${fc.sat}%, ${fc.lum}%)`,
          "--era-accent-faint":  `hsla(${fc.hue}, 60%, 65%, 0.38)`,
          "--era-border-subtle": `hsla(${fc.hue}, 45%, 48%, 0.28)`,
          background: "#0d1220",
          cursor: isAwake ? "default" : "pointer",
        } as React.CSSProperties
      }
    >
      {/* ── Ambient glow + particle dots ── */}
      <motion.div
        className="era-shell-glow pointer-events-none absolute inset-0 z-0"
        animate={{ opacity: isAwake ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: isAwake ? 0.1 : 0 }}
      />
      <EraDots />

      {/* ── Top pill nav ── */}
      <EraFaceNav />

      {/* ── Content area (between nav and bottom edge) ── */}
      <div
        ref={contentRef}
        className="absolute inset-x-0"
        style={{ top: 52, bottom: 0 }}
      >
        <div className="relative h-full">

          {/* ─── ERA DOT — always present ───────────────────────────────────
              Spring-animates between:
                hub   → centred (hubDotTop), full scale
                module → top (moduleDotTop), shrunk (MODULE_SCALE)
              transformOrigin "top center" so it shrinks upward when scaling down. */}
          <motion.div
            className="absolute left-1/2 z-10 pointer-events-none"
            style={{ x: "-50%", transformOrigin: "top center" }}
            animate={isHub
              ? { top: hubDotTop, scale: 1 }
              : { top: moduleDotTop, scale: MODULE_SCALE }
            }
            transition={{ type: "spring", stiffness: 145, damping: 24 }}
          >
            {/* Greeting — fades out when switching to module */}
            <AnimatePresence>
              {isHub && (
                <motion.div
                  key="greeting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.26 }}
                  className="mb-6 text-center"
                >
                  <p className="text-[19px] font-medium leading-tight text-white/80 md:text-xl">
                    {greeting}
                  </p>
                  <p className="mt-1.5 text-[13px] text-white/42">
                    4 modules on deck. Speak to any of them.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop: 3-ring orbital container + ERA mark */}
            <div className="hidden md:block">
              <motion.div
                className="relative"
                style={{ width: 500, height: 500 }}
                animate={{ filter: isAwake ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.35)" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="era-hub-ring-outer absolute inset-0 rounded-full" />
                <div className="era-hub-ring-mid   absolute rounded-full" style={{ inset: 26 }} />
                <div className="era-hub-ring-inner absolute rounded-full" style={{ inset: 54 }} />
                <div
                  className="absolute flex items-center justify-center"
                  style={{ inset: 0 }}
                >
                  {/* Crossfade mark when moduleKey changes */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={moduleKey}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      <ERAMark module={moduleKey} size={240} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            {/* Mobile: single ring, smaller mark */}
            <motion.div
              className="relative md:hidden"
              animate={{ filter: isAwake ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.35)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div
                className="era-hub-ring-inner absolute rounded-full"
                style={{ inset: -24 }}
              />
              <ERAMark module={moduleKey} size={160} />
            </motion.div>

          </motion.div>

          {/* ─── Hub scatter widgets (desktop, hub mode) ─────────────────── */}
          <HubScatterWidgets />

          {/* ─── Module dashboard (below shrunk ERA DOT) ─────────────────── */}
          <AnimatePresence mode="wait">
            {!isHub && (
              <motion.div
                key={activeFaceKey}
                className="absolute inset-x-0 overflow-y-auto"
                style={{ top: dashboardTop, bottom: 0 }}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, delay: 0.2, ease: "easeOut" }}
              >
                {/* Bottom padding clears the CommandBar (80px mobile offset + ~52px height) */}
                <div className="pb-[148px] md:pb-[80px]">
                  <DashboardContent faceKey={activeFaceKey} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ── ERA conversation thread — appears above command bar ── */}
      <AnimatePresence>
        {isAwake && <EraThreadTranscript key="era-thread" />}
      </AnimatePresence>

      {/* ── AI proposal confirm card (Slice 4) — sits just above the command bar ── */}
      <AnimatePresence>
        {isAwake && <EraProposalCard key="era-proposal" />}
      </AnimatePresence>

      {/* ── Floating command bar (always visible) ── */}
      <CommandBar />
    </div>
  );
}

// Shows the last few turns of the active ERA conversation — not just the
// latest reply. Reads `era_messages` via the same hooks the (now-retired)
// EraTranscript used, so this is real conversation history, not a
// re-derived summary: whatever CommandBar or voice just wrote is what
// appears here, from both surfaces, on both devices (useEraMessagesRealtime).
// Typewriter effect applies only to the newest assistant row, once.
const MAX_VISIBLE_TURNS = 6;

function EraThreadTranscript() {
  const { data: conversation } = useActiveEraConversation();
  const conversationId = conversation?.id ?? null;
  const { data } = useEraMessages(conversationId);
  useEraMessagesRealtime(conversationId);

  const messages = data?.messages ?? [];
  const newestAssistant =
    [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  // Depend on primitive id/content, not the `.find()` result object — a new
  // array/object reference arrives on every refetch (React Query, realtime)
  // even when nothing changed, and putting that object straight in a
  // useEffect dependency array — worse, mirroring its id into state and
  // depending on THAT too — retriggers the effect on its own state update,
  // tearing down the typewriter's setInterval a tick or two after it starts.
  const newestAssistantId = newestAssistant?.id ?? null;
  const newestAssistantContent = newestAssistant?.content ?? "";

  const typedIdRef = useRef<string | null>(null);
  const [displayed, setDisplayed] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newestAssistantId || newestAssistantId === typedIdRef.current) return;
    typedIdRef.current = newestAssistantId;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(newestAssistantContent.slice(0, i));
      if (i >= newestAssistantContent.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [newestAssistantId, newestAssistantContent]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) return null;
  const recent = messages.slice(-MAX_VISIBLE_TURNS);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="absolute inset-x-0 z-20 flex justify-center px-5 bottom-[148px] md:bottom-[72px]"
    >
      <div
        ref={listRef}
        className="flex w-full max-w-[560px] flex-col gap-2 overflow-y-auto rounded-2xl px-4 py-3"
        style={{
          background: "rgba(13, 18, 32, 0.88)",
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.08))",
          maxHeight: 240,
        }}
      >
        {recent.map((m) => {
          const isNewestAssistant =
            m.role === "assistant" && m.id === newestAssistant?.id;
          return (
            <p
              key={m.id}
              className="text-[13px] font-mono leading-relaxed tracking-wide"
              style={{
                color:
                  m.role === "user"
                    ? "rgba(255,255,255,0.55)"
                    : "var(--era-accent)",
              }}
            >
              {m.role === "user" ? "› " : ""}
              {isNewestAssistant ? displayed : m.content}
              {isNewestAssistant && displayed.length < m.content.length && (
                <span
                  className="ml-[2px] inline-block h-[14px] w-[2px] animate-pulse align-middle"
                  style={{ backgroundColor: "var(--era-accent)", opacity: 0.9 }}
                />
              )}
            </p>
          );
        })}
      </div>
    </motion.div>
  );
}

// AI-proposed action (Slice 4) — nothing behind this card has been written
// yet; Confirm performs the real writes (POST /api/items, POST
// .../prerequisites), Dismiss just clears it. Renders only while
// `activeProposal` is set — the manual-handoff pattern's one shipped kind.
function EraProposalCard() {
  const { activeProposal, confirmProposal, dismissProposal } = useEraAskAI();
  if (!activeProposal) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="absolute inset-x-0 z-25 flex justify-center px-5 bottom-[148px] md:bottom-[76px]"
    >
      <div
        className="flex w-full max-w-[560px] flex-col gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "rgba(13, 18, 32, 0.94)",
          border: "1px solid var(--era-border-subtle, rgba(255,255,255,0.14))",
        }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--era-accent)" }}>
          {activeProposal.text}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={dismissProposal}
            className="rounded-full px-3 py-1.5 text-xs text-white/60 transition-opacity hover:opacity-80"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={confirmProposal}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: "var(--era-accent, white)",
              color: "#0d1220",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </motion.div>
  );
}
