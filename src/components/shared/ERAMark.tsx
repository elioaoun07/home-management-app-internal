"use client";

import React from "react";

export type ERAModuleKey =
  | "financial"
  | "recipe"
  | "schedule"
  | "health"
  | "home"
  | "trip"
  | "fitness"
  | "outfit"
  | "chat"
  | "memory";

const ERA_MODULES: Record<
  ERAModuleKey,
  { name: string; hue: number; sat: number; lum: number; cue: string }
> = {
  financial: { name: "Financial", hue: 175, sat: 72, lum: 55, cue: "fin" },
  recipe:    { name: "Recipe",    hue:  28, sat: 85, lum: 58, cue: "rec" },
  schedule:  { name: "Schedule",  hue: 256, sat: 78, lum: 68, cue: "sch" },
  health:    { name: "Health",    hue: 352, sat: 82, lum: 62, cue: "hlt" },
  home:      { name: "Home",      hue: 205, sat: 75, lum: 62, cue: "hom" },
  trip:      { name: "Trip",      hue: 155, sat: 72, lum: 58, cue: "trp" },
  fitness:   { name: "Fitness",   hue:  40, sat: 92, lum: 62, cue: "fit" },
  outfit:    { name: "Outfit",    hue: 325, sat: 78, lum: 68, cue: "ofi" },
  chat:      { name: "Chat",      hue: 190, sat: 85, lum: 62, cue: "chat"},
  memory:    { name: "Memory",    hue: 220, sat: 65, lum: 68, cue: "mem" },
};

type Props = {
  module?: ERAModuleKey;
  size?: number;
  className?: string;
};

export function ERAMark({ module = "financial", size = 40, className = "" }: Props) {
  const m = ERA_MODULES[module] ?? ERA_MODULES.financial;

  const style = {
    "--hue": m.hue,
    "--sat": `${m.sat}%`,
    "--lum": `${m.lum}%`,
    width: size,
    height: size,
  } as React.CSSProperties;

  const cue = m.cue;

  return (
    <div className={`era-mark ${className}`} style={style} aria-label={`ERA ${m.name}`}>
      <div className="era-aura" />
      <div className="era-ring" />

      <div className={`era-cue era-cue-fin${cue === "fin" ? " active" : ""}`}>
        <svg viewBox="0 0 260 260" preserveAspectRatio="none">
          <path className="trail-ghost" d="M40 190 Q 98 180 122 138 T 220 70" />
          <path className="trail"       d="M40 190 Q 98 180 122 138 T 220 70" />
          <circle className="dot d1" cx="40"  cy="190" r="4" />
          <circle className="dot d2" cx="220" cy="70"  r="4" />
        </svg>
      </div>

      <div className={`era-cue era-cue-rec${cue === "rec" ? " active" : ""}`}>
        <svg viewBox="0 0 128 128" preserveAspectRatio="none">
          <path className="v1" d="M56 108 Q 52 94 58 80 T 54 54" />
          <path className="v2" d="M64 116 Q 60 98 66 82 T 62 52" />
          <path className="v3" d="M72 110 Q 76 96 70 82 T 74 58" />
        </svg>
      </div>

      <div className={`era-cue era-cue-sch${cue === "sch" ? " active" : ""}`}>
        <div className="hand" />
        <div className="hand short" />
      </div>

      <div className={`era-cue era-cue-hlt${cue === "hlt" ? " active" : ""}`}>
        <svg viewBox="0 0 260 48" preserveAspectRatio="none">
          <path d="M0 24 L70 24 L82 24 L90 10 L100 38 L108 4 L118 44 L128 24 L260 24" />
        </svg>
        <div className="beat b1" />
        <div className="beat b2" />
      </div>

      <div className={`era-cue era-cue-hom${cue === "hom" ? " active" : ""}`}>
        <svg viewBox="0 0 260 260">
          <path d="M80 140 L130 92 L180 140" />
        </svg>
      </div>

      <div className={`era-cue era-cue-trp${cue === "trp" ? " active" : ""}`}>
        <div className="dotring" />
        <div className="needle" />
      </div>

      <div className={`era-cue era-cue-fit${cue === "fit" ? " active" : ""}`}>
        <div className="pulse p-left" />
        <div className="pulse p-right" />
        <div className="pulse p-top" />
        <div className="pulse p-bottom" />
      </div>

      <div className={`era-cue era-cue-ofi${cue === "ofi" ? " active" : ""}`} />

      <div className={`era-cue era-cue-chat${cue === "chat" ? " active" : ""}`}>
        <div className="hum h1" />
        <div className="hum h2" />
      </div>

      <div className={`era-cue era-cue-mem${cue === "mem" ? " active" : ""}`}>
        <div className="recall m1" />
        <div className="recall m2" />
        <div className="recall m3" />
      </div>

      <div className="era-core" />
    </div>
  );
}
