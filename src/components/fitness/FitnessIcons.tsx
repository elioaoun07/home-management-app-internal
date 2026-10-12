// src/components/fitness/FitnessIcons.tsx
// Fitness SVG icon set — thin strokes + a single accent node, in the ERA
// futuristic line language. All inherit currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export function CoreIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="8.5" opacity=".45" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="20.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlanIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3" opacity=".45" />
      <path d="M8 9h8M8 13h5M8 17h3" />
      <circle cx="17" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function QuestIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3l7 4v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V7l7-4z" opacity=".45" />
      <path d="M9 12.5l2 2 4-4.5" />
    </svg>
  );
}

export function ProgressIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 19h16" opacity=".45" />
      <path d="M6 16l4-5 3 3 5-7" />
      <circle cx="18" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DumbbellIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6.5 8v8M9 6.5v11M15 6.5v11M17.5 8v8" />
      <path d="M9 12h6" opacity=".6" />
      <path d="M4 10.5v3M20 10.5v3" opacity=".45" />
    </svg>
  );
}

export function RecoveryIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 20c-4-2.5-7-5.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 3.6-3 6.5-7 9z" opacity=".45" />
      <path d="M8 12h2l1.2-2 1.6 4 1.2-2h2" />
    </svg>
  );
}

export function TimerIcon({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="13" r="7.5" opacity=".45" />
      <path d="M12 9.5V13l2.5 1.5M10 3h4" />
    </svg>
  );
}

export function BadgeFrame({ size = 44, unlocked, frame, color }: { size?: number; unlocked: boolean; frame: string; color: string }) {
  const sides = frame === "apex" ? 8 : frame === "vanguard" ? 6 : frame === "momentum" ? 5 : 4;
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    return `${22 + 18 * Math.cos(a)},${22 + 18 * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden>
      <polygon points={pts} fill={unlocked ? `${color}22` : "transparent"} stroke={unlocked ? color : "currentColor"} strokeOpacity={unlocked ? 1 : 0.25} strokeWidth="1.5" />
      {unlocked ? <circle cx="22" cy="22" r="4" fill={color} /> : <path d="M18 23h8v6h-8zM19.5 23v-2.5a2.5 2.5 0 0 1 5 0V23" stroke="currentColor" strokeOpacity=".35" fill="none" strokeWidth="1.4" />}
    </svg>
  );
}
