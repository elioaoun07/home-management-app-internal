"use client";

// src/components/era/EraShell.tsx
// ERA hub — a radial briefing interface.
//
// Layout (desktop):
//   • "ERA" wordmark — top center, very faint
//   • Greeting + subtitle — above the center mark
//   • Large ERAMark + 3 orbital rings — absolute center
//   • Active face label — below the mark
//   • Four face cards — corner-positioned
//   • Floating command pill — bottom center
//
// Layout (mobile):
//   • Same center section (smaller mark, one ring)
//   • Face chips row above command bar instead of corner cards
//   • Command bar sits above MobileNav

import React from "react";
import { ERAMark } from "@/components/shared/ERAMark";
import { FACES, getFace } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
import { useUser } from "@/contexts/UserContext";
import { CommandBar } from "./CommandBar";
import { EraFaceCard } from "./EraFaceCard";
import { EraDots } from "./EraDots";

const ERA_MODULE_COLORS: Record<string, { hue: number; sat: number; lum: number }> = {
  financial: { hue: 175, sat: 72, lum: 55 },
  recipe:    { hue:  28, sat: 85, lum: 58 },
  schedule:  { hue: 256, sat: 78, lum: 68 },
  health:    { hue: 352, sat: 82, lum: 62 },
  home:      { hue: 205, sat: 75, lum: 62 },
  trip:      { hue: 155, sat: 72, lum: 58 },
  fitness:   { hue:  40, sat: 92, lum: 62 },
  outfit:    { hue: 325, sat: 78, lum: 68 },
  chat:      { hue: 190, sat: 85, lum: 62 },
  memory:    { hue: 220, sat: 65, lum: 68 },
};

const MODULE_HUE: Record<string, number> = Object.fromEntries(
  Object.entries(ERA_MODULE_COLORS).map(([k, v]) => [k, v.hue])
);

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Face order for corner positions: TL, TR, BL, BR
const FACE_POSITIONS = [
  { key: "schedule", pos: "tl" },
  { key: "budget",   pos: "tr" },
  { key: "brain",    pos: "bl" },
  { key: "chef",     pos: "br" },
] as const;

export function EraShell() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const setActiveFace = useEraStore((s) => s.setActiveFace);
  const isAwake = useEraStore((s) => s.isAwake);
  const wake = useEraStore((s) => s.wake);
  const face = getFace(activeFaceKey);
  const fc = ERA_MODULE_COLORS[face.eraModuleKey] ?? ERA_MODULE_COLORS.financial;
  const user = useUser();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const greeting = `${getTimeGreeting()}${firstName ? `, ${firstName}.` : "."}`;

  return (
    <div
      className="era-shell fixed inset-0 overflow-hidden"
      data-awake={isAwake}
      onClick={!isAwake ? wake : undefined}
      style={
        {
          "--era-hue": fc.hue,
          // While sleeping: desaturate + dim so everything reads grey
          "--era-sat": isAwake ? `${fc.sat}%` : "0%",
          "--era-lum": isAwake ? `${fc.lum}%` : "18%",
          background: "#0d1220",
          cursor: isAwake ? "default" : "pointer",
        } as React.CSSProperties
      }
    >
      {/* ── Ambient layer ── */}
      <div className="era-shell-glow pointer-events-none absolute inset-0 z-0" />
      <EraDots />

      {/* ── ERA wordmark ── */}
      <div className="absolute top-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <span className="era-wordmark">ERA</span>
      </div>

      {/* ── Center hub — fills the shell, flex-centers the mark ── */}
      <div
        className={[
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center",
          // on mobile push center up to clear the command bar + nav
          "pb-[148px] md:pb-[80px]",
        ].join(" ")}
      >
        {/* Greeting */}
        <div className="mb-7 text-center">
          <p className="text-[19px] font-medium leading-tight text-white/80 md:text-xl">
            {greeting}
          </p>
          <p className="mt-1.5 text-[13px] text-white/45">
            {FACES.length} threads on deck. Speak to any of them.
          </p>
        </div>

        {/* Orbital ring container + ERAMark */}
        {/* Desktop: 500px container with 3 rings + 240px mark */}
        <div className="hidden md:block">
          <div className="relative" style={{ width: 500, height: 500 }}>
            {/* Outer ring */}
            <div className="era-hub-ring-outer absolute inset-0 rounded-full" />
            {/* Mid ring */}
            <div className="era-hub-ring-mid absolute rounded-full" style={{ inset: 26 }} />
            {/* Inner ring */}
            <div className="era-hub-ring-inner absolute rounded-full" style={{ inset: 54 }} />
            {/* Mark centered — greyscale+dim while sleeping, transitions to color on wake */}
            <div
              className="absolute flex items-center justify-center"
              style={{ inset: 0 }}
            >
              <div
                className="era-mark-filter"
                style={{ filter: isAwake ? "none" : "grayscale(1) brightness(0.35)" }}
              >
                <ERAMark module={face.eraModuleKey} size={240} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: simpler single-ring view */}
        <div className="relative md:hidden">
          <div
            className="era-hub-ring-inner absolute rounded-full"
            style={{ inset: -24 }}
          />
          <div
            className="era-mark-filter"
            style={{ filter: isAwake ? "none" : "grayscale(1) brightness(0.35)" }}
          >
            <ERAMark module={face.eraModuleKey} size={160} />
          </div>
        </div>

        {/* Active face label */}
        <div className="mt-5 text-center">
          <p className="era-face-label">{face.label}</p>
        </div>
      </div>

      {/* ── Desktop corner face cards ── */}
      {FACE_POSITIONS.map(({ key, pos }) => {
        const f = getFace(key);
        return (
          <EraFaceCard
            key={key}
            face={f}
            isActive={activeFaceKey === key}
            position={pos}
          />
        );
      })}

      {/* ── Mobile face chip row (above command bar) ── */}
      <div
        className={[
          "absolute inset-x-0 z-20 md:hidden",
          "bottom-[148px] flex justify-center gap-2 px-4",
        ].join(" ")}
      >
        {FACES.map((f) => {
          const isActive = f.key === activeFaceKey;
          const hue = MODULE_HUE[f.eraModuleKey] ?? 175;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFace(f.key)}
              className={[
                "era-mobile-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
                isActive ? "era-mobile-chip-active text-white/85" : "text-white/45",
              ].join(" ")}
            >
              <span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{
                  background: `hsl(${hue}, 75%, 65%)`,
                  boxShadow: isActive ? `0 0 5px hsl(${hue}, 75%, 55%)` : "none",
                }}
              />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── Floating command bar ── */}
      <CommandBar />
    </div>
  );
}
