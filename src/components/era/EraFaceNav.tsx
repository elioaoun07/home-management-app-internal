"use client";

// ERA Face Nav — top pill row for switching between ERA hub and face dashboards.
// ERA dot = chat/hub, Budget/Schedule/Chef/Brain = full dashboards.

import { ERAMark } from "@/components/shared/ERAMark";
import { FACES } from "@/features/era/faceRegistry";
import type { FaceKey } from "@/features/era/types";
import { useEraStore } from "@/features/era/useEraStore";

const FACE_HUE: Record<string, number> = {
  financial: 175,
  recipe: 28,
  schedule: 256,
  memory: 220,
};

const FACE_LABEL: Record<FaceKey, string> = {
  budget: "Budget",
  schedule: "Schedule",
  chef: "Recipes",
  brain: "Brain",
};

export function EraFaceNav() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const activeView = useEraStore((s) => s.activeView);
  const setActiveView = useEraStore((s) => s.setActiveView);
  const openDashboard = useEraStore((s) => s.openDashboard);
  const isAwake = useEraStore((s) => s.isAwake);

  if (!isAwake) return null;

  const isHub = activeView === "hub";

  return (
    <div
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1 px-4 py-3"
      style={{ background: "linear-gradient(to bottom, rgba(13,18,32,0.95) 60%, rgba(13,18,32,0))" }}
    >
      {/* ERA (hub/chat) */}
      <button
        type="button"
        onClick={() => setActiveView("hub")}
        className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
        style={
          isHub
            ? {
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.9)",
              }
            : {
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.38)",
              }
        }
      >
        <span className="era-gradient-text text-[11px] font-bold tracking-widest">ERA</span>
      </button>

      {/* Separator dot */}
      <span className="mx-0.5 h-1 w-1 rounded-full bg-white/15" />

      {/* Face dots */}
      {FACES.map((face) => {
        const isActive = !isHub && activeFaceKey === face.key;
        const hue = FACE_HUE[face.eraModuleKey] ?? 175;
        const dotColor = `hsl(${hue}, 72%, 65%)`;
        const dotGlow = `0 0 8px hsl(${hue}, 72%, 55%)`;

        return (
          <button
            key={face.key}
            type="button"
            onClick={() => openDashboard(face.key)}
            className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
            style={
              isActive
                ? {
                    background: `hsla(${hue}, 30%, 12%, 0.9)`,
                    border: `1px solid hsla(${hue}, 55%, 45%, 0.35)`,
                    color: `hsl(${hue}, 72%, 75%)`,
                    boxShadow: `0 0 12px hsla(${hue}, 60%, 40%, 0.2)`,
                  }
                : {
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.38)",
                  }
            }
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-all"
              style={
                isActive
                  ? { background: dotColor, boxShadow: dotGlow }
                  : { background: "rgba(255,255,255,0.2)" }
              }
            />
            {FACE_LABEL[face.key]}
          </button>
        );
      })}
    </div>
  );
}
