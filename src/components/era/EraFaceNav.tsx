"use client";

// ERA Face Nav — top pill row for switching between ERA hub and face dashboards.
// ERA dot = chat/hub, Budget/Schedule/Chef/Brain = full dashboards.

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { FACES } from "@/features/era/faceRegistry";
import type { FaceKey } from "@/features/era/types";
import { useEraStore } from "@/features/era/useEraStore";
import styles from "./EraMotion.module.css";

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

function NavPill({
  active,
  hue = 190,
  onClick,
  children,
  desktop = false,
}: {
  active: boolean;
  hue?: number;
  onClick: () => void;
  children: ReactNode;
  desktop?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={`${styles.navPill} ${desktop ? styles.desktopPill : ""}`}
      style={{ "--pill-hue": hue } as CSSProperties}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
    >
      {active && (
        <motion.span
          aria-hidden="true"
          className={styles.navActive}
          layoutId={reducedMotion ? undefined : "active-face"}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
      {children}
    </motion.button>
  );
}

export function EraFaceNav() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const activeView = useEraStore((s) => s.activeView);
  const setActiveView = useEraStore((s) => s.setActiveView);
  const openDashboard = useEraStore((s) => s.openDashboard);
  const isAwake = useEraStore((s) => s.isAwake);
  const rowRef = useRef<HTMLDivElement>(null);
  const navId = useId();
  const reducedMotion = useReducedMotion();

  // A swipe can land on a pill scrolled out of view — bring it back.
  useEffect(() => {
    rowRef.current
      ?.querySelector<HTMLElement>("[data-active='true']")
      ?.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
  }, [activeView, activeFaceKey, reducedMotion]);

  if (!isAwake) return null;

  const isHub = activeView === "hub";

  return (
    <LayoutGroup id={navId}>
      <nav
        ref={rowRef}
        aria-label="ERA views"
        className={`${styles.nav} absolute inset-x-0 top-0 z-20 flex items-center justify-start gap-1 overflow-x-auto scrollbar-hide px-4 md:justify-center`}
        style={{
          background:
            "linear-gradient(to bottom, rgba(13,18,32,0.95) 60%, rgba(13,18,32,0))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* ERA (hub/chat) */}
        <NavPill active={isHub} onClick={() => setActiveView("hub")}>
          <span className="era-gradient-text text-[11px] font-bold tracking-widest">
            ERA
          </span>
        </NavPill>

        {/* Separator dot */}
        <span className="mx-0.5 h-1 w-1 shrink-0 rounded-full bg-white/15" />

        {/* Face dots */}
        {FACES.map((face) => {
          const isActive =
            activeView === "dashboard" && activeFaceKey === face.key;
          const hue = FACE_HUE[face.eraModuleKey] ?? 175;
          return (
            <NavPill
              key={face.key}
              onClick={() => openDashboard(face.key)}
              active={isActive}
              hue={hue}
            >
              <span className={styles.navDot} aria-hidden="true" />
              {FACE_LABEL[face.key]}
            </NavPill>
          );
        })}

        {/* Separator dot */}
        <span className="mx-0.5 h-1 w-1 shrink-0 rounded-full bg-white/15" />

        {/* Artifacts — today's log of everything ERA created/updated */}
        <NavPill
          onClick={() => setActiveView("activity")}
          active={activeView === "activity"}
        >
          Artifacts
        </NavPill>

        {/* AI Usage — desktop only (EraShell sends a phone back to the hub) */}
        <NavPill
          onClick={() => setActiveView("usage")}
          active={activeView === "usage"}
          desktop
        >
          AI Usage
        </NavPill>
      </nav>
    </LayoutGroup>
  );
}
