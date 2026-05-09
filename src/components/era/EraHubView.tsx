"use client";

// ERA Hub view — the centered Agentic OS radial interface.
// ERA dot = "chat" module (hue 190°): the ERAMark + orbital rings IS the interface.
// CommandBar at the bottom handles all interaction; this view is the visual brain.

import React from "react";
import { ERAMark } from "@/components/shared/ERAMark";
import { FACES, getFace } from "@/features/era/faceRegistry";
import { useEraStore } from "@/features/era/useEraStore";
import { useUser } from "@/contexts/UserContext";

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function EraHubView() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const isAwake       = useEraStore((s) => s.isAwake);
  const face          = getFace(activeFaceKey);
  const user          = useUser();
  const firstName     = user?.name?.split(" ")[0] ?? "";
  const greeting      = `${getTimeGreeting()}${firstName ? `, ${firstName}.` : "."}`;

  return (
    <div className="pointer-events-none flex h-full flex-col items-center justify-center">
      {/* Greeting */}
      <div className="mb-7 text-center">
        <p className="text-[19px] font-medium leading-tight text-white/80 md:text-xl">
          {greeting}
        </p>
        <p className="mt-1.5 text-[13px] text-white/45">
          {FACES.length} threads on deck. Speak to any of them.
        </p>
      </div>

      {/* Desktop: 500px orbital ring container + 240px mark */}
      <div className="hidden md:block">
        <div className="relative" style={{ width: 500, height: 500 }}>
          <div className="era-hub-ring-outer absolute inset-0 rounded-full" />
          <div className="era-hub-ring-mid absolute rounded-full" style={{ inset: 26 }} />
          <div className="era-hub-ring-inner absolute rounded-full" style={{ inset: 54 }} />
          <div className="absolute flex items-center justify-center" style={{ inset: 0 }}>
            <div
              className="era-mark-filter"
              style={{ filter: isAwake ? "none" : "grayscale(1) brightness(0.35)" }}
            >
              <ERAMark module={face.eraModuleKey} size={240} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: single-ring, smaller mark */}
      <div className="relative md:hidden">
        <div className="era-hub-ring-inner absolute rounded-full" style={{ inset: -24 }} />
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
  );
}
