"use client";

// ERA Shell — Agentic OS interface.
//
// The ERA DOT is always rendered and spring-animates between two positions:
//   hub mode     → full-size, vertically centered, chat hue (190°)
//   module mode  → small at top (scale 0.34), module hue, dashboard scrolls below
//
// Every color (glow, CommandBar border, icons, text accent) is driven by
// --era-hue / --era-accent CSS variables that shapeshift with the active module.
//
// HUB-86 — while a conversation is open in hub view ("conversing"), the DOT
// takes its module-mode position (same spring) and the thread fills the space
// between it and the command bar. New chat brings the DOT and greeting back
// to the centre. With no conversation the hub is unchanged.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getFace } from "@/features/era/faceRegistry";
import { useEraAskAI } from "@/features/era/useEraAskAI";
import { useRestoreNewChat } from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { useEraTurn } from "@/features/era/useEraTurn";
import { useEraWakeListener } from "@/features/era/useEraWakeListener";
import { useConversationMode } from "@/features/voice-conversation/hooks/useConversationMode";
import { unlockAudioContext } from "@/features/voice-conversation/audioContext";
import { preloadGreetings } from "@/features/voice-conversation/greetingCache";
import { ERAMark } from "@/components/shared/ERAMark";
import { useUser } from "@/contexts/UserContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { BudgetDashboard } from "./dashboards/BudgetDashboard";
import { ScheduleDashboard } from "./dashboards/ScheduleDashboard";
import { ChefDashboard } from "./dashboards/ChefDashboard";
import { BrainDashboard } from "./dashboards/BrainDashboard";
import { ArtifactsView } from "./dashboards/ArtifactsView";
import { CommandBar } from "./CommandBar";
import { EraAskChips } from "./EraAskChips";
import { EraChatDrawer } from "./EraChatDrawer";
import { EraChatToolbar, useActiveThreadState } from "./EraChatToolbar";
import { EraConversation } from "./EraConversation";
import { EraDots } from "./EraDots";
import { EraFaceNav } from "./EraFaceNav";
import { EraHistorySheet } from "./EraHistorySheet";
import { EraProposalCard } from "./EraProposalCard";
import { HubScatterWidgets } from "./HubScatterWidgets";
import { MODULE_COLORS } from "./eraHues";

// Kept for existing imports; the card now lives in its own file (HUB-86).
export { EraProposalCard };

// Heights used to centre the ERA DOT block in hub mode.
// The motion.div contains: greeting (~80px) + ring (500px) + label (~40px).
const RING_H        = 500;  // ring container height (desktop)
const RING_H_MOBILE = 208;  // mobile single-ring diameter (era-hub-ring-inner box)
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
  const isMobile       = useIsMobile();
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  // The one entry point from "a sentence" to "a reply" — shared with
  // CommandBar so typed and voice input can never disagree (HUB-16).
  const { runTurn } = useEraTurn();
  // Stage C2 — wired into the conversation engine's `handlers.askAI` below,
  // so a voice dig-deeper escalation goes through the same registry-aware
  // path a typed "Ask AI" tap does (EraProposalCard renders whatever
  // proposal either one produces, via the shared store).
  const { askAI, confirmProposal, dismissProposal } = useEraAskAI();
  // HUB-86 — a New chat from before a reload still applies.
  useRestoreNewChat();

  const firstName = user?.name?.split(" ")[0] ?? "";
  const setVoiceReplyEnabled = useEraStore((s) => s.setVoiceReplyEnabled);
  const voiceChatEnabled = useEraStore((s) => s.voiceChatEnabled);

  // Unlock AudioContext on first user gesture — needed for voice-wake TTS to play.
  // Also pre-caches the 3 greeting variants for the current time of day so the
  // greeting plays from an AudioBuffer (~instant) instead of waiting for Azure fetch.
  const handleFirstInteraction = useCallback(() => {
    unlockAudioContext();
    preloadGreetings(firstName || undefined);
  }, [firstName]);

  useEffect(() => {
    if (!voiceChatEnabled) return;
    handleFirstInteraction();
  }, [voiceChatEnabled, handleFirstInteraction]);

  // Conversation engine — handles wake detection, TTS greeting, and voice Q&A.
  const { wake: engineWake, isEnabled: convModeEnabled } = useConversationMode({
    enabled: voiceChatEnabled,
    userName: firstName || undefined,
    onWake: (source) => {
      wake();
      // Voice wake auto-enables the speaker so ERA speaks back.
      // Click/tap wake leaves the speaker in whatever state the user set.
      if (source === "speech") setVoiceReplyEnabled(true);
    },
    handlers: {
      onWillSpeak: (text) => setEraReply(text),
      // Same brain as the command bar — see useEraTurn. The engine inspects
      // `kind`/`aiHandled` to decide whether to offer the AI dig-deeper
      // prompt (Stage C already auto-escalated a language-gap miss).
      runTurn: async (text) => {
        const { reply, intent, aiHandled } = await runTurn(text);
        // HUB-82 — a confirm card is up: voice takes yes/no for it.
        const awaitingConfirm = useEraStore.getState().activeProposal?.kind === "native_action";
        return { reply, kind: intent.kind, aiHandled, awaitingConfirm };
      },
      confirmProposal: async () => {
        await confirmProposal();
        return useEraStore.getState().eraReply;
      },
      dismissProposal,
      // Stage C2 — the capability-gap dig-deeper path; skipUserMessage
      // because runTurn already persisted this transcript as a user turn.
      askAI: (text) => askAI(text, { skipUserMessage: true }),
      sessionId: undefined,
    },
  });

  // Fallback wake listener — only runs when conversation engine is not supported
  useEraWakeListener({ enabled: voiceChatEnabled && !convModeEnabled });

  const hubModuleKey = useEraStore((s) => s.hubModuleKey);
  const face      = getFace(activeFaceKey);
  const isHub      = activeView === "hub";
  const isActivity = activeView === "activity";
  const turnInFlight = useEraStore((s) => s.turnInFlight);
  const { hasTurns } = useActiveThreadState();
  // HUB-86 — the hub shows a conversation (DOT risen, thread below it).
  const conversing = isAwake && isHub && (hasTurns || turnInFlight);
  const heroHub    = isHub && !conversing;
  // Hub → tracks last mentioned module (starts as "chat", shifts when user addresses a face);
  // Activity → neutral chat hue, it isn't tied to any one face;
  // Module dashboard → that face's module key.
  const moduleKey = isHub ? hubModuleKey : isActivity ? "chat" : face.eraModuleKey;
  const fc        = MODULE_COLORS[moduleKey] ?? MODULE_COLORS.chat;

  const greeting  = `${getTimeGreeting()}${firstName ? `, ${firstName}.` : "."}`;

  // Mobile module/activity views hide the floating chat surface behind
  // EraChatDrawer — close it automatically if the user steps back to Hub.
  useEffect(() => {
    if (isHub) setChatDrawerOpen(false);
  }, [isHub]);

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
  // Dashboard starts below the shrunk ERA DOT + gap. Mobile renders a single
  // ring (RING_H_MOBILE), not the desktop 3-ring orbital (RING_H) — using the
  // desktop constant on mobile over-reserves space above the dashboard.
  const ringH         = isMobile ? RING_H_MOBILE : RING_H;
  const dashboardTop  = Math.round(moduleDotTop + ringH * MODULE_SCALE + 20);

  return (
    <div
      className="era-shell fixed inset-0 overflow-hidden"
      data-awake={isAwake}
      data-conversing={conversing}
      onClick={!isAwake ? () => { wake(); engineWake(); } : undefined}
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
            animate={heroHub
              ? { top: hubDotTop, scale: 1 }
              : { top: moduleDotTop, scale: MODULE_SCALE }
            }
            transition={{ type: "spring", stiffness: 145, damping: 24 }}
          >
            {/* Greeting — fades out when switching to module */}
            <AnimatePresence>
              {heroHub && (
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

            {/* Mobile: single ring, smaller mark — fixed box (not inset math
                against an implicit parent) so the ring is a true circle,
                centered on the mark regardless of surrounding flow width. */}
            <div className="relative mx-auto md:hidden" style={{ width: 160, height: 160 }}>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ filter: isAwake ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.35)" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {/* `inset`, not `left/top` + `transform`: the ring's own
                    `era-orbit-breathe` animation (globals.css) owns the
                    `transform` property outright and silently discards any
                    inline transform, which is what produced the original
                    off-center ring. `inset` doesn't touch `transform`, and
                    is exact now that the parent box is a fixed 160×160. */}
                <div
                  className="era-hub-ring-inner absolute rounded-full"
                  style={{ inset: -(RING_H_MOBILE - 160) / 2 }}
                />
                <ERAMark module={moduleKey} size={160} />
              </motion.div>
            </div>

          </motion.div>

          {/* ─── Hub scatter widgets (desktop, hub mode) ─────────────────── */}
          <HubScatterWidgets />

          {/* ─── HUB-86 — the conversation, below the risen ERA DOT ──────────
              Mounted only while conversing; no exit animation (the DOT's
              return to centre is the transition), so nothing invisible can
              linger over the hub. Bottom clears the command bar. */}
          {conversing && (
            <motion.div
              className="absolute inset-x-0 z-20 bottom-[148px] md:bottom-[88px]"
              style={{ top: dashboardTop }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }}
            >
              <EraConversation layout="stage" />
            </motion.div>
          )}

          {/* ─── Module dashboard (below shrunk ERA DOT) ─────────────────── */}
          <AnimatePresence mode="wait">
            {!isHub && (
              <motion.div
                key={isActivity ? "activity" : activeFaceKey}
                className="absolute inset-x-0 overflow-y-auto"
                style={{ top: dashboardTop, bottom: 0 }}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, delay: 0.2, ease: "easeOut" }}
              >
                {/* Bottom padding clears the CommandBar (80px mobile offset + ~52px height) */}
                <div className="pb-[148px] md:pb-[80px]">
                  {isActivity ? <ArtifactsView /> : <DashboardContent faceKey={activeFaceKey} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ── Desktop module/activity views: the conversation as a compact
          panel above the command bar (pointer events only on the panel). ── */}
      {!isMobile && !isHub && isAwake && (
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-5 bottom-[84px] [&>*]:pointer-events-auto">
          <EraConversation layout="panel" />
        </div>
      )}

      {/* ── Mobile module/activity views with the chat sheet closed: an
          action awaiting confirmation stays reachable (voice can raise one).
          Everywhere else the card and chips are the thread's newest turn. ── */}
      <AnimatePresence>
        {isAwake && isMobile && !isHub && !chatDrawerOpen && (
          <EraProposalCard key="era-proposal" />
        )}
        {isAwake && isMobile && !isHub && !chatDrawerOpen && (
          <EraAskChips key="era-ask-chips" />
        )}
      </AnimatePresence>

      {/* ── History / New chat (hub) ── */}
      <EraChatToolbar />

      {/* ── Floating command bar — same gating as the thread above ── */}
      {(!isMobile || isHub) && <CommandBar />}

      {/* ── Mobile module/activity chat bubble + bottom sheet ── */}
      {isMobile && !isHub && isAwake && (
        <EraChatDrawer open={chatDrawerOpen} onOpenChange={setChatDrawerOpen} />
      )}

      {/* ── HUB-52 — past chats ── */}
      {isAwake && <EraHistorySheet />}
    </div>
  );
}
