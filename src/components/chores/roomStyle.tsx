import type { ReactNode } from "react";

/**
 * Look of a room tile: gradient wash, accent colour and an SVG shaped after the
 * room's purpose. Same tile language as the Trips packing categories (inline
 * gradients, not Tailwind classes, so a missing class can't render a flat tile).
 */
export interface RoomStyle {
  /** Base hex of the tile wash */
  gradient: string;
  /** Icon and accent colour */
  accent: string;
  icon: (color: string) => ReactNode;
}

/** Appends an 8-bit alpha channel to a #rrggbb value. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function roomGradient(
  style: RoomStyle,
  direction: "to bottom right" | "to bottom" = "to bottom right",
): string {
  return `linear-gradient(${direction}, ${withAlpha(style.gradient, 0.38)} 0%, ${withAlpha(style.gradient, 0.16)} 55%, ${withAlpha(style.gradient, 0.05)} 100%)`;
}

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
    {children}
  </svg>
);
const line = {
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STYLES = {
  kitchen: {
    gradient: "#f43f5e",
    accent: "#fb7185",
    // Pot with steam
    icon: (c) =>
      svg(
        <>
          <path d="M9 18h22v8a6 6 0 01-6 6H15a6 6 0 01-6-6v-8z" stroke={c} {...line} />
          <path d="M6 18h28M14 14v-2M20 14V9M26 14v-2" stroke={c} {...line} />
          <path d="M33 21h3M4 21h2" stroke={c} {...line} opacity="0.6" />
        </>,
      ),
  },
  bathroom: {
    gradient: "#06b6d4",
    accent: "#22d3ee",
    // Toilet
    icon: (c) =>
      svg(
        <>
          <path d="M12 6h16v8H12z" stroke={c} {...line} />
          <path d="M9 14h22c0 8-3 12-8 13v5h-6v-5c-5-1-8-5-8-13z" stroke={c} {...line} />
          <path d="M26 9h.01" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
        </>,
      ),
  },
  master: {
    gradient: "#6366f1",
    accent: "#818cf8",
    // Bed with moon
    icon: (c) =>
      svg(
        <>
          <path d="M5 30V16M5 25h30v5M35 25v-4a4 4 0 00-4-4H16v8" stroke={c} {...line} />
          <circle cx="10.5" cy="21" r="2.4" stroke={c} {...line} />
          <path d="M31 5.5a5 5 0 11-5.5 6.8 4 4 0 005.5-6.8z" stroke={c} {...line} />
        </>,
      ),
  },
  living: {
    gradient: "#10b981",
    accent: "#34d399",
    // TV on a stand
    icon: (c) =>
      svg(
        <>
          <rect x="6" y="9" width="28" height="18" rx="3" stroke={c} {...line} />
          <path d="M14 33h12M20 27v6" stroke={c} {...line} />
          <path d="M12 15l4 0M12 20l9 0" stroke={c} {...line} opacity="0.45" />
        </>,
      ),
  },
  salon: {
    gradient: "#8b5cf6",
    accent: "#a78bfa",
    // Sofa
    icon: (c) =>
      svg(
        <>
          <path d="M9 17a3 3 0 013-3h16a3 3 0 013 3v5H9v-5z" stroke={c} {...line} />
          <path d="M5 22a3 3 0 016 0v4h18v-4a3 3 0 016 0v7H5v-7z" stroke={c} {...line} />
          <path d="M9 32v3M31 32v3" stroke={c} {...line} />
        </>,
      ),
  },
  balcony: {
    gradient: "#0ea5e9",
    accent: "#38bdf8",
    // Railing with a plant
    icon: (c) =>
      svg(
        <>
          <path d="M5 21h30M5 33h30M9 21v12M16 21v12M23 21v12M30 21v12" stroke={c} {...line} />
          <path d="M20 15c-4 0-6-3-6-6 4 0 6 3 6 6zM20 15c4 0 6-3 6-6-4 0-6 3-6 6z" stroke={c} {...line} />
          <path d="M20 15v6" stroke={c} {...line} />
        </>,
      ),
  },
  entrance: {
    gradient: "#f59e0b",
    accent: "#fbbf24",
    // Door
    icon: (c) =>
      svg(
        <>
          <path d="M11 34V8a2 2 0 012-2h14a2 2 0 012 2v26" stroke={c} {...line} />
          <path d="M6 34h28" stroke={c} {...line} />
          <circle cx="24.5" cy="21" r="1.6" fill={c} fillOpacity="0.7" />
          <path d="M16 12h8M16 17h8" stroke={c} {...line} opacity="0.4" />
        </>,
      ),
  },
  corridor: {
    gradient: "#64748b",
    accent: "#94a3b8",
    // Hallway receding to a door
    icon: (c) =>
      svg(
        <>
          <path d="M5 5l10 8v14L5 35zM35 5L25 13v14l10 8z" stroke={c} {...line} />
          <rect x="15" y="13" width="10" height="14" stroke={c} {...line} />
          <path d="M15 27h10" stroke={c} {...line} opacity="0.5" />
        </>,
      ),
  },
  kidsRoom: {
    gradient: "#f97316",
    accent: "#fb923c",
    // Toy blocks
    icon: (c) =>
      svg(
        <>
          <rect x="6" y="21" width="12" height="12" rx="1.5" stroke={c} {...line} />
          <rect x="20" y="21" width="12" height="12" rx="1.5" stroke={c} {...line} />
          <rect x="13" y="8" width="12" height="12" rx="1.5" stroke={c} {...line} />
          <path d="M19 12l1.2 2.4 2.6.4-1.9 1.8.5 2.6L19 18l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" stroke={c} strokeWidth="1.1" strokeLinejoin="round" />
        </>,
      ),
  },
} satisfies Record<string, RoomStyle>;

type RoomStyleKey = keyof typeof STYLES;

/** Name patterns, most specific first ("Master Bedroom" before any "…room"). */
const ALIASES: Array<[RegExp, RoomStyleKey]> = [
  [/kitchen|cuisine/, "kitchen"],
  [/bath|toilet|wc|shower|lavatory/, "bathroom"],
  [/master|parent/, "master"],
  [/living|lounge|tv/, "living"],
  [/salon|sitting|reception/, "salon"],
  [/balcon|terrace|patio|garden/, "balcony"],
  [/entr|hall(?!way)|foyer|lobby/, "entrance"],
  [/corridor|hallway|passage/, "corridor"],
  [/room|bed|kid|nursery|chambre/, "kidsRoom"],
];

/** Fallback look for rooms outside the list, stable per room id. */
const FALLBACK: RoomStyle[] = [
  {
    gradient: "#84cc16",
    accent: "#a3e635",
    icon: (c) =>
      svg(
        <>
          <path d="M6 19L20 7l14 12" stroke={c} {...line} />
          <path d="M10 17v16h20V17" stroke={c} {...line} />
          <rect x="17" y="23" width="6" height="10" stroke={c} {...line} />
        </>,
      ),
  },
  {
    gradient: "#d946ef",
    accent: "#e879f9",
    icon: (c) =>
      svg(<path d="M20 5l13 8v14l-13 8-13-8V13z" stroke={c} {...line} />),
  },
];

function hash(text: string): number {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = (value * 33) ^ text.charCodeAt(i);
  return Math.abs(value);
}

export function getRoomStyle(name: string, id?: string | null): RoomStyle {
  const normalized = name.trim().toLowerCase();
  const alias = ALIASES.find(([pattern]) => pattern.test(normalized));
  if (alias) return STYLES[alias[1]];
  return FALLBACK[hash(id ?? name) % FALLBACK.length];
}

/** Chores without a room. */
export const NO_ROOM_STYLE: RoomStyle = {
  gradient: "#94a3b8",
  accent: "#94a3b8",
  icon: (c) =>
    svg(
      <>
        <rect x="6" y="12" width="28" height="19" rx="3" stroke={c} {...line} />
        <path d="M6 17h28" stroke={c} {...line} opacity="0.4" />
        <circle cx="13" cy="24" r="2.2" fill={c} fillOpacity="0.6" />
        <circle cx="20" cy="24" r="2.2" fill={c} fillOpacity="0.4" />
        <circle cx="27" cy="24" r="2.2" fill={c} fillOpacity="0.25" />
      </>,
    ),
};
