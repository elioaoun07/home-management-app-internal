"use client";

// ERA Shell — Agentic OS interface.
//
// The ERA DOT is always rendered and spring-animates between two positions:
//   hub mode     → full-size, vertically centered, chat hue (190°)
//   module mode  → small at top (scale 0.34), module hue, dashboard scrolls below
//
// Every color (glow, CommandBar border, icons, text accent) is driven by
// --era-hue / --era-accent CSS variables that shapeshift with the active module.

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getFace } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
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
  const user          = useUser();

  const hubModuleKey = useEraStore((s) => s.hubModuleKey);
  const face      = getFace(activeFaceKey);
  // Hub → tracks last mentioned module (starts as "chat", shifts when user addresses a face);
  // Module dashboard → that face's module key.
  const moduleKey = activeView === "hub" ? hubModuleKey : face.eraModuleKey;
  const fc        = MODULE_COLORS[moduleKey] ?? MODULE_COLORS.chat;
  const isHub     = activeView === "hub";

  const firstName = user?.name?.split(" ")[0] ?? "";
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
      onClick={!isAwake ? wake : undefined}
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

            {/* Face label — hub only */}
            <AnimatePresence>
              {isHub && (
                <motion.div
                  key="label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, delay: 0.08 }}
                  className="mt-4 text-center"
                >
                  <p className="era-face-label">{face.label}</p>
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* ── Floating command bar (always visible) ── */}
      <CommandBar />
    </div>
  );
}
