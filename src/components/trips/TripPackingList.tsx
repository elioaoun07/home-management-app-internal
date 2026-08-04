"use client";

import {
  useBulkCreatePackingItems,
  useCreatePackingCategory,
  useCreatePackingItem,
  useDeletePackingCategory,
  useDeletePackingItem,
  useReorderPackingItems,
  useRestorePackingItem,
  useRevertPackingCheckpoint,
  useSavePackingCheckpoint,
  useTripPacking,
  useTripPackingCategories,
  useTripPackingCheckpoint,
  useTripPackingDeleted,
  useUpdatePackingCategory,
  useUpdatePackingItem,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { PACKING_PRESETS, type PackingPreset } from "@/constants/packingPresets";
import type { TripPackingCategory, TripPackingItem } from "@/types/trips";
import { MoreHorizontal, Plus, Trash2, ArrowLeft, Pencil, GripVertical, RotateCcw, Sparkles, Save, History } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ToastIcons } from "@/lib/toastIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/DropdownMenu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Category metadata ────────────────────────────────────────────────────────

type CategoryMeta = {
  /** Base hex for the tile wash. Kept as a raw value (not a Tailwind class) so the
   * gradient is applied inline like iconColor/borderColor — a lookup table like this
   * is exactly the shape Tailwind's scanner handles badly, and a missing/stale
   * `from-*` class silently renders a flat, colourless tile. */
  gradientColor: string;
  /** Opacity stops for the wash, defaults to [0.35, 0.15, 0.05]. */
  gradientStops?: [number, number, number] | number[];
  iconColor: string;
  borderColor: string;
  icon: (color: string) => React.ReactNode;
};

/** Appends an 8-bit alpha channel to a #rrggbb value. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/** Builds the tile wash as an inline `linear-gradient`, mirroring the three-stop
 * `from-X/35 via-X/15 to-X/5` ramp the tiles used to get from Tailwind. */
function categoryGradient(meta: CategoryMeta, direction: "to bottom right" | "to bottom"): string {
  const [from, via, to] = meta.gradientStops ?? [0.35, 0.15, 0.05];
  const c = meta.gradientColor;
  return `linear-gradient(${direction}, ${withAlpha(c, from)} 0%, ${withAlpha(c, via)} 50%, ${withAlpha(c, to)} 100%)`;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  Documents: {
    gradientColor: "#f59e0b",
    iconColor: "#fbbf24",
    borderColor: "rgba(251,191,36,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="8" y="4" width="17" height="24" rx="2.5" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M18 4v8h7" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 18h11" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 22h11" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 26h7" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="30" cy="32" r="5.5" fill={c} fillOpacity="0.18" stroke={c} strokeWidth="1.2" />
        <path d="M27.5 32l1.8 1.8 3-3.6" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  Clothes: {
    gradientColor: "#3b82f6",
    iconColor: "#60a5fa",
    borderColor: "rgba(96,165,250,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M15 6L8 11v6l5-2v17a1 1 0 001 1h12a1 1 0 001-1V15l5 2v-6l-7-5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 6c0 3 2.2 5 5 5s5-2 5-5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  Electronics: {
    gradientColor: "#8b5cf6",
    iconColor: "#a78bfa",
    borderColor: "rgba(167,139,250,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="9" y="6" width="15" height="24" rx="2.5" stroke={c} strokeWidth="1.6" />
        <line x1="14" y1="28" x2="19" y2="28" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <path d="M24 14l7-3.5-4 7.5h4l-7 8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  Toiletries: {
    gradientColor: "#06b6d4",
    iconColor: "#22d3ee",
    borderColor: "rgba(34,211,238,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M20 5C20 5 11 17 11 24a9 9 0 0018 0c0-7-9-19-9-19z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 25a5 3.5 0 0010 0" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M20 5v6" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  Health: {
    gradientColor: "#f43f5e",
    iconColor: "#fb7185",
    borderColor: "rgba(251,113,133,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M20 32s-14-9.5-14-19a8 8 0 0114-5.3A8 8 0 0134 13c0 9.5-14 19-14 19z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 18h8M20 14v8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  Money: {
    gradientColor: "#10b981",
    iconColor: "#34d399",
    borderColor: "rgba(52,211,153,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="5" y="12" width="30" height="18" rx="3.5" stroke={c} strokeWidth="1.6" />
        <circle cx="20" cy="21" r="4.5" stroke={c} strokeWidth="1.6" />
        <path d="M5 17h30" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        <path d="M5 25h30" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        <circle cx="10" cy="21" r="1.5" fill={c} fillOpacity="0.5" />
        <circle cx="30" cy="21" r="1.5" fill={c} fillOpacity="0.5" />
      </svg>
    ),
  },
  Accessories: {
    gradientColor: "#ec4899",
    iconColor: "#f472b6",
    borderColor: "rgba(244,114,182,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <polygon
          points="20,4 23.5,14.5 35,14.5 25.5,21 29,32 20,25.5 11,32 14.5,21 5,14.5 16.5,14.5"
          stroke={c}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={c}
          fillOpacity="0.12"
        />
      </svg>
    ),
  },
  Other: {
    gradientColor: "#94a3b8",
    gradientStops: [0.3, 0.12, 0.04],
    iconColor: "#94a3b8",
    borderColor: "rgba(148,163,184,0.2)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="6" y="12" width="28" height="19" rx="3" stroke={c} strokeWidth="1.6" />
        <path d="M6 17h28" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        <circle cx="13" cy="23.5" r="2.5" fill={c} fillOpacity="0.65" />
        <circle cx="20" cy="23.5" r="2.5" fill={c} fillOpacity="0.45" />
        <circle cx="27" cy="23.5" r="2.5" fill={c} fillOpacity="0.25" />
      </svg>
    ),
  },
  Shoes: {
    gradientColor: "#f97316",
    iconColor: "#fb923c",
    borderColor: "rgba(251,146,60,0.25)",
    // Shoe outline from Tabler Icons (MIT) — https://tabler.io/icons/icon/shoe
    // 24×24 source grid; stroke width tuned down from Tabler's 2 to sit at the same
    // visual weight as the hand-drawn 40×40 icons around it.
    icon: (c) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <path d="M4 6h5.426a1 1 0 0 1 .863 .496l1.064 1.823a3 3 0 0 0 1.896 1.407l4.677 1.114a4 4 0 0 1 3.074 3.89v2.27a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1" />
        <path d="M14 13l1 -2" />
        <path d="M8 18v-1a4 4 0 0 0 -4 -4h-1" />
        <path d="M10 12l1.5 -3" />
      </svg>
    ),
  },
  Bags: {
    gradientColor: "#14b8a6",
    iconColor: "#2dd4bf",
    borderColor: "rgba(45,212,191,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="7" y="14" width="26" height="18" rx="3" stroke={c} strokeWidth="1.6" />
        <path d="M15 14v-2.5a3 3 0 013-3h4a3 3 0 013 3V14" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 21h26" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        <path d="M17 21v5M23 21v5" stroke={c} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
      </svg>
    ),
  },
  Swim: {
    gradientColor: "#818cf8",
    iconColor: "#818cf8",
    borderColor: "rgba(129,140,248,0.25)",
    // Two-piece swimwear: linked cups with shoulder straps above a swim bottom.
    // Hand-drawn — no permissively-licensed swimwear glyph exists in Tabler/Lucide.
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <path d="M9 11l4.5 4M31 11l-4.5 4" />
        <circle cx="13.5" cy="16" r="5.5" />
        <circle cx="26.5" cy="16" r="5.5" />
        <path d="M19 16h2" />
        <path d="M10 26.5c3.3-1.8 6.6-1.8 10 0 3.4-1.8 6.7-1.8 10 0l-2.5 6.8c-2.2-1.2-4.9-1.2-7.5 0-2.6-1.2-5.3-1.2-7.5 0z" />
      </svg>
    ),
  },
};

/** Substring aliases so category names close to a built-in (case, pluralization,
 * compound names like "Documents & Wallet") still resolve to the right meta
 * instead of falling through to the generic palette. Checked in order — more
 * specific terms first so e.g. "swimwear" matches Swim before any clothing term. */
const CATEGORY_ALIASES: Array<[RegExp, keyof typeof CATEGORY_META]> = [
  [/swim|underwear|bikini|lingerie/, "Swim"],
  [/shoe|footwear|sneaker|boot|sandal/, "Shoes"],
  [/\bbag|luggage|suitcase|backpack/, "Bags"],
  [/document|passport|wallet/, "Documents"],
  [/cloth|shirt|outfit|apparel/, "Clothes"],
  [/electronic|gadget|charger|cable|tech/, "Electronics"],
  [/toiletr|hygiene|cosmetic/, "Toiletries"],
  [/health|medic|pharma|first.?aid/, "Health"],
  [/money|cash|currency|financ/, "Money"],
  [/accessor|jewel|watch|sunglass/, "Accessories"],
];

/** Deterministic fallback for anything that matches no built-in or alias — a
 * rotating palette so unrecognized categories still look distinct from each
 * other rather than all collapsing onto the same flat gray "Other" look. */
const FALLBACK_PALETTE: CategoryMeta[] = [
  {
    gradientColor: "#84cc16",
    iconColor: "#a3e635",
    borderColor: "rgba(163,230,53,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M20 5l4.5 9.2 10.1 1.5-7.3 7.1 1.7 10.1L20 28.3l-9 4.6 1.7-10.1-7.3-7.1 10.1-1.5z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    gradientColor: "#d946ef",
    iconColor: "#e879f9",
    borderColor: "rgba(232,121,249,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <polygon points="20,5 33,13 33,27 20,35 7,27 7,13" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    gradientColor: "#0ea5e9",
    iconColor: "#38bdf8",
    borderColor: "rgba(56,189,248,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="14" stroke={c} strokeWidth="1.6" />
        <path d="M20 12v8l6 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    gradientColor: "#ef4444",
    gradientStops: [0.3, 0.12, 0.04],
    iconColor: "#f87171",
    borderColor: "rgba(248,113,113,0.2)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M20 32s-14-9.5-14-19a8 8 0 0114-5.3A8 8 0 0134 13c0 9.5-14 19-14 19z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    gradientColor: "#facc15",
    iconColor: "#facc15",
    borderColor: "rgba(250,204,21,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path d="M22 4L9 23h8l-3 13 15-21h-9z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    gradientColor: "#a855f7",
    iconColor: "#c084fc",
    borderColor: "rgba(192,132,252,0.25)",
    icon: (c) => (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="13" stroke={c} strokeWidth="1.6" />
        <circle cx="20" cy="20" r="6.5" stroke={c} strokeWidth="1.4" opacity="0.6" />
      </svg>
    ),
  },
];

type CategoryRef = Pick<TripPackingCategory, "id" | "name"> | { id: null; name: string };

function categoryKey(category: CategoryRef): string {
  return category.id ? `category:${category.id}` : `legacy:${category.name}`;
}

/** Simple deterministic string hash (djb2) — stable across renders/sessions so
 * a given category id always lands on the same fallback palette entry. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  return Math.abs(hash);
}

/**
 * Resolves display metadata for a packing category. Categories are DB rows
 * (`trip_packing_category`) with an id + free-typed name, not a fixed enum —
 * the user can create any name at any time. Resolution order:
 *   1. Exact match (case-insensitive) against a built-in name.
 *   2. Keyword alias match (handles compounds like "Documents & Wallet").
 *   3. Deterministic fallback palette, hashed on the category's stable `id`
 *      (falling back to name for the legacy id-less "Other"/free-text bucket)
 *      so a renamed category keeps its look instead of jumping to a new one.
 */
function getCategoryMeta(category: CategoryRef): CategoryMeta {
  const normalized = category.name.trim().toLowerCase();
  const exact = (Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).find(
    (key) => key.toLowerCase() === normalized,
  );
  if (exact) return CATEGORY_META[exact];

  const alias = CATEGORY_ALIASES.find(([pattern]) => pattern.test(normalized));
  if (alias) return CATEGORY_META[alias[1]];

  const hashKey = category.id ?? category.name;
  return FALLBACK_PALETTE[hashString(hashKey) % FALLBACK_PALETTE.length];
}

// ── Quantity stepper ─────────────────────────────────────────────────────────

function QtyControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) onChange(n);
    else setDraft(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-10 text-center text-sm bg-white/10 border border-white/20 rounded text-white outline-none py-0.5"
        value={draft}
        inputMode="numeric"
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        className="w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 6h8" />
        </svg>
      </button>
      <button
        className="px-1.5 text-sm font-mono text-white/70 hover:text-white transition-colors min-w-[20px] text-center"
        onClick={() => setEditing(true)}
      >
        {value}
      </button>
      <button
        className="w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        onClick={() => onChange(value + 1)}
      >
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 2v8M2 6h8" />
        </svg>
      </button>
    </div>
  );
}

// ── Packed ring (for quantity > 1 items) ────────────────────────────────────

function PackedRing({
  packedQty,
  quantity,
  iconColor,
  onCycle,
}: {
  packedQty: number;
  quantity: number;
  iconColor: string;
  onCycle: (next: number) => void;
}) {
  const isFullyPacked = packedQty >= quantity;
  const partial = packedQty > 0 && !isFullyPacked;
  const color = isFullyPacked ? "#34d399" : iconColor;

  // SVG ring: r=10, circ≈62.83, start from 12 o'clock
  const r = 10;
  const circ = 2 * Math.PI * r;
  const filled = (packedQty / quantity) * circ;

  const handleTap = () => {
    const next = packedQty >= quantity ? 0 : packedQty + 1;
    onCycle(next);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <button
        onClick={handleTap}
        className="w-6 h-6 flex items-center justify-center transition-transform active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          {/* Background track */}
          <circle
            cx="12" cy="12" r={r}
            stroke={isFullyPacked ? color : "rgba(255,255,255,0.15)"}
            strokeWidth="2"
            fill={isFullyPacked ? `${color}20` : "transparent"}
          />
          {/* Progress arc */}
          {partial && (
            <circle
              cx="12" cy="12" r={r}
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${filled} ${circ}`}
              strokeDashoffset={circ * 0.25}
              strokeLinecap="round"
            />
          )}
          {/* Checkmark when fully packed */}
          {isFullyPacked && (
            <path
              d="M8 12l2.5 2.5 5.5-5"
              stroke="black"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </button>
      {/* Fraction label under the ring */}
      <span
        className="text-[9px] font-semibold tabular-nums leading-none"
        style={{ color: isFullyPacked ? "#34d399" : packedQty > 0 ? color : "rgba(255,255,255,0.25)" }}
      >
        {packedQty}/{quantity}
      </span>
    </div>
  );
}

// ── Assignment chip ──────────────────────────────────────────────────────────
// Person-absolute color identity per CLAUDE.md Hard Rule #14: derive blue/pink
// from the viewer's theme, not from role — same pattern as ChoreCard.tsx.

function AssignChip({
  assignedTo,
  currentUserId,
  partnerId,
  partnerName,
  onCycle,
}: {
  assignedTo: string | null;
  currentUserId: string | null;
  partnerId: string | null;
  partnerName: string;
  onCycle: (next: string | null) => void;
}) {
  const { theme } = useTheme();
  if (!partnerId) return null;

  const isPink = theme === "pink";
  const meColor = isPink ? "#ec4899" : "#3b82f6";
  const partnerColor = isPink ? "#3b82f6" : "#ec4899";

  const handleTap = () => {
    // Cycle: unassigned -> me -> partner -> unassigned
    if (assignedTo === null) onCycle(currentUserId);
    else if (assignedTo === currentUserId) onCycle(partnerId);
    else onCycle(null);
  };

  if (assignedTo === null) {
    return (
      <button
        onClick={handleTap}
        className="flex-shrink-0 w-5 h-5 rounded-full border border-dashed border-white/20 text-white/0 hover:border-white/40 transition-colors"
        aria-label="Assign to"
      />
    );
  }

  const isMe = assignedTo === currentUserId;
  const color = isMe ? meColor : partnerColor;
  const label = isMe ? "You" : partnerName;

  return (
    <button
      onClick={handleTap}
      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
      style={{ backgroundColor: `${color}30`, color, border: `1px solid ${color}60` }}
      aria-label={`Assigned to ${label}`}
      title={label}
    >
      {label[0]?.toUpperCase()}
    </button>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  tripId,
  iconColor,
  currentUserId,
  partnerId,
  partnerName,
  sortable,
}: {
  item: TripPackingItem;
  tripId: string;
  iconColor: string;
  currentUserId?: string | null;
  partnerId?: string | null;
  partnerName?: string;
  /** When true, renders a drag handle and participates in the enclosing dnd-kit sort context. */
  sortable?: boolean;
}) {
  const updateItem = useUpdatePackingItem(tripId);
  const deleteItem = useDeletePackingItem(tripId);
  const [nameEdit, setNameEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });
  const dragStyle: React.CSSProperties = sortable
    ? { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
    : {};

  const packedQty = item.packed_quantity ?? (item.is_packed ? item.quantity : 0);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== item.name) {
      updateItem.mutate({ id: item.id, name: trimmed });
    } else {
      setNameDraft(item.name);
    }
    setNameEdit(false);
  };

  const handleSimpleToggle = () => {
    const newPacked = !item.is_packed;
    updateItem.mutate({
      id: item.id,
      packed_quantity: newPacked ? item.quantity : 0,
      is_packed: newPacked,
    });
  };

  const handleCycleQty = (next: number) => {
    updateItem.mutate({
      id: item.id,
      packed_quantity: next,
      is_packed: next >= item.quantity,
    });
  };

  const isFullyPacked = item.is_packed || packedQty >= item.quantity;

  return (
    <div
      ref={sortable ? setNodeRef : undefined}
      style={dragStyle}
      className={cn("py-2.5 border-b border-white/8 last:border-0 group")}
    >
      {/* One-line layout: name flexes; compact controls stay grouped at the right. */}
      <div className="flex items-center gap-2">
        {sortable && (
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 p-1 -ml-1 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Check: simple toggle for qty=1, ring cycle for qty>1 */}
        {item.quantity > 1 ? (
          <PackedRing
            packedQty={packedQty}
            quantity={item.quantity}
            iconColor={iconColor}
            onCycle={handleCycleQty}
          />
        ) : (
          <button
            onClick={handleSimpleToggle}
            className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
            style={{
              borderColor: isFullyPacked ? iconColor : "rgba(255,255,255,0.25)",
              backgroundColor: isFullyPacked ? iconColor : "transparent",
            }}
          >
            {isFullyPacked && (
              <svg className="w-3 h-3 text-black" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 5l2.5 2.5 4-4" />
              </svg>
            )}
          </button>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          {nameEdit ? (
            <input
              autoFocus
              className="w-full text-base bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white outline-none"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setNameDraft(item.name); setNameEdit(false); }
              }}
            />
          ) : (
            <span
              onClick={() => setNameEdit(true)}
              className={cn(
                "text-base cursor-text block break-words",
                isFullyPacked ? "line-through text-white/30" : "text-white/85",
              )}
            >
              {item.name}
            </span>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5">
          <QtyControl
            value={item.quantity}
            onChange={(v) => updateItem.mutate({ id: item.id, quantity: v })}
          />
          {partnerId && (
            <AssignChip
              assignedTo={item.assigned_to}
              currentUserId={currentUserId ?? null}
              partnerId={partnerId}
              partnerName={partnerName ?? "Partner"}
              onCycle={(next) => updateItem.mutate({ id: item.id, assigned_to: next })}
            />
          )}
          <button
            onClick={() => deleteItem.mutate(item.id)}
            className="flex-shrink-0 p-1.5 text-white/25 hover:text-red-400 active:text-red-400 transition-colors"
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline add row ───────────────────────────────────────────────────────────

function InlineAddRow({
  tripId,
  categoryId,
  iconColor,
}: {
  tripId: string;
  categoryId: string | null;
  iconColor: string;
}) {
  const createItem = useCreatePackingItem(tripId);
  const [active, setActive] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) { setActive(false); return; }
    const submittedQty = qty;

    // Clear immediately: the mutation adds its own optimistic row, so this form
    // is ready for the next item without waiting for the network round-trip.
    setName("");
    setQty(1);
    requestAnimationFrame(() => inputRef.current?.focus());

    createItem.mutate(
      { name: trimmed, category_id: categoryId, quantity: submittedQty },
      {
        onError: () => {
          // Do not overwrite an item the user has started typing meanwhile.
          setName((current) => current || trimmed);
          setQty((current) => current === 1 ? submittedQty : current);
          requestAnimationFrame(() => inputRef.current?.focus());
        },
      },
    );
  }, [name, qty, categoryId, createItem]);

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center gap-2.5 py-3 text-white/35 hover:text-white/60 transition-colors text-base"
      >
        <Plus className="w-4 h-4 flex-shrink-0" />
        <span>Add item</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="w-6 h-6 flex-shrink-0 rounded-full border-2 border-dashed flex items-center justify-center"
        style={{ borderColor: `${iconColor}60` }}
      />
      <input
        ref={inputRef}
        className="flex-1 min-w-0 text-base bg-transparent text-white placeholder:text-white/30 outline-none border-b border-white/20 pb-0.5"
        placeholder="Item name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setActive(false); setName(""); setQty(1); }
        }}
        onBlur={() => { if (!name.trim()) { setActive(false); setQty(1); } }}
        autoFocus
      />
      <QtyControl value={qty} onChange={setQty} />
      <button
        onClick={submit}
        disabled={!name.trim()}
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: iconColor }}
      >
        <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5l2.5 2.5 4-4" />
        </svg>
      </button>
    </div>
  );
}

// ── Rename category sheet ────────────────────────────────────────────────────

function RenameCategorySheet({
  category,
  tripId,
  open,
  onOpenChange,
}: {
  category: CategoryRef;
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tc = useThemeClasses();
  const updateCategory = useUpdatePackingCategory(tripId);
  const deleteCategory = useDeletePackingCategory(tripId);
  const [newName, setNewName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === category.name) { onOpenChange(false); return; }
    setSaving(true);
    try {
      if (category.id) {
        await updateCategory.mutateAsync({ id: category.id, name: trimmed });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    setSaving(true);
    try {
      if (category.id) {
        await deleteCategory.mutateAsync(category.id);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn("bg-white/5 border text-white placeholder:text-white/30", tc.border);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage)}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">Edit category</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-8">
          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Category name</Label>
            <Input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sports gear"
              autoFocus
            />
          </div>
          <Button
            onClick={handleRename}
            disabled={saving || !newName.trim()}
            className={cn("w-full border font-medium", tc.bgSurface, tc.text, tc.border)}
          >
            {saving ? "Saving…" : "Rename category"}
          </Button>
          <Button
            onClick={handleDeleteCategory}
            disabled={saving}
            variant="ghost"
            className="w-full text-rose-400 hover:bg-rose-500/10"
          >
            Move items to Other &amp; remove
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Category switcher (keeps the item canvas full-width) ──────────────────

function CategorySwitcher({
  allCategories,
  byCategory,
  focusedKey,
  onSelect,
}: {
  allCategories: CategoryRef[];
  byCategory: Record<string, TripPackingItem[]>;
  focusedKey: string;
  onSelect: (key: string) => void;
}) {
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [focusedKey]);

  return (
    <nav
      aria-label="Packing categories"
      className="relative flex-shrink-0 border-y border-white/8"
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2.5 snap-x">
        {allCategories.map((category) => {
          const key = categoryKey(category);
          const items = byCategory[key] ?? [];
          const meta = getCategoryMeta(category);
          const active = key === focusedKey;
          const packed = items.filter((item) => item.is_packed).length;
          const total = items.length;
          return (
            <button
              key={key}
              ref={active ? activeButtonRef : undefined}
              onClick={() => onSelect(key)}
              aria-pressed={active}
              className={cn(
                "flex-shrink-0 snap-start h-11 max-w-44 rounded-xl px-2.5 flex items-center gap-2 border text-left transition-colors",
                active ? "bg-white/10" : "border-white/8 hover:bg-white/5",
              )}
              style={active ? { borderColor: `${meta.iconColor}70` } : undefined}
            >
              <span
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${meta.iconColor}18` }}
              >
                <span style={{ color: meta.iconColor, transform: "scale(0.42)" }}>{meta.icon(meta.iconColor)}</span>
              </span>
              <span className="min-w-0">
                <span className={cn("block text-xs truncate", active ? "text-white" : "text-white/65")}>{category.name}</span>
                <span
                  className="block text-[10px] tabular-nums"
                  style={{ color: total > 0 && packed === total ? "#34d399" : "rgba(255,255,255,0.35)" }}
                >
                  {packed}/{total}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Category focus content (one category's items; remounted per switch) ────

function CategoryFocusContent({
  category,
  items,
  tripId,
  currentUserId,
  partnerId,
  partnerName,
  allCategories,
  byCategory,
  onFocusCategory,
  onClose,
}: {
  category: CategoryRef;
  items: TripPackingItem[];
  tripId: string;
  currentUserId?: string | null;
  partnerId?: string | null;
  partnerName?: string;
  allCategories: CategoryRef[];
  byCategory: Record<string, TripPackingItem[]>;
  onFocusCategory: (key: string) => void;
  onClose: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const meta = getCategoryMeta(category);
  const reorderItems = useReorderPackingItems(tripId);
  const [orderedIds, setOrderedIds] = useState<string[]>(items.map((i) => i.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Keep local order in sync as items are added/removed, but preserve any drag reorder.
  const knownIds = new Set(orderedIds);
  const mergedIds = [...orderedIds.filter((id) => items.some((i) => i.id === id)), ...items.filter((i) => !knownIds.has(i.id)).map((i) => i.id)];
  const orderedItems = mergedIds.map((id) => items.find((i) => i.id === id)).filter((i): i is TripPackingItem => !!i);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = mergedIds.indexOf(active.id as string);
    const newIndex = mergedIds.indexOf(over.id as string);
    const next = arrayMove(mergedIds, oldIndex, newIndex);
    setOrderedIds(next);
    reorderItems.mutate(next.map((id, position) => ({ id, position })));
  };

  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;
  const allPacked = total > 0 && packed === total;

  return (
    <>
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Subtle gradient tint behind header */}
        <div
          className="absolute inset-x-0 top-0 h-48 pointer-events-none"
          style={{ backgroundImage: categoryGradient(meta, "to bottom"), opacity: 0.45 }}
        />

        {/* Header */}
        <div className="relative flex-shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="-ml-2 h-10 px-2 rounded-xl flex items-center gap-2 text-sm text-white/55 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Back to all packing categories"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
              <span>All packages</span>
            </button>

            <div className="flex items-center gap-2 flex-shrink-0">
              {category.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[150px]">
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      Edit category
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 min-w-0">
            <span
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${meta.iconColor}14`, border: `1px solid ${meta.iconColor}25` }}
            >
              <span style={{ color: meta.iconColor, transform: "scale(0.56)" }}>{meta.icon(meta.iconColor)}</span>
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white leading-tight break-words">{category.name}</h2>
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: allPacked && total > 0 ? "#34d399" : meta.iconColor }}
              >
                {packed}/{total} packed
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full h-1 rounded-full bg-white/10">
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: total > 0 ? `${(packed / total) * 100}%` : "0%",
                backgroundColor: allPacked && total > 0 ? "#34d399" : meta.iconColor,
              }}
            />
          </div>
        </div>

        <CategorySwitcher
          allCategories={allCategories}
          byCategory={byCategory}
          focusedKey={categoryKey(category)}
          onSelect={onFocusCategory}
        />

        {/* Items list */}
        <div className="relative flex-1 overflow-y-auto px-4 pb-safe-area-inset-bottom">
          {items.length === 0 && (
            <p className="text-center text-sm text-white/25 py-6">No items yet — add one below</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mergedIds} strategy={verticalListSortingStrategy}>
              {orderedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  tripId={tripId}
                  iconColor={meta.iconColor}
                  currentUserId={currentUserId}
                  partnerId={partnerId}
                  partnerName={partnerName}
                  sortable
                />
              ))}
            </SortableContext>
          </DndContext>
          <InlineAddRow tripId={tripId} categoryId={category.id} iconColor={meta.iconColor} />
        </div>
      </div>

      {editOpen && (
        <RenameCategorySheet
          category={category}
          tripId={tripId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

// ── Category focus panel (full-screen overlay + collapsible sidebar) ────────

function CategoryFocusPanel({
  allCategories,
  byCategory,
  focusedKey,
  onFocusCategory,
  tripId,
  currentUserId,
  partnerId,
  partnerName,
  onClose,
}: {
  allCategories: CategoryRef[];
  byCategory: Record<string, TripPackingItem[]>;
  focusedKey: string;
  onFocusCategory: (key: string) => void;
  tripId: string;
  currentUserId?: string | null;
  partnerId?: string | null;
  partnerName?: string;
  onClose: () => void;
}) {
  const tc = useThemeClasses();
  const category = allCategories.find((c) => categoryKey(c) === focusedKey) ?? allCategories[0];
  const items = byCategory[focusedKey] ?? [];

  return (
    <div className={cn("fixed inset-0 z-50 flex", tc.bgPage)}>
      <CategoryFocusContent
        key={focusedKey}
        category={category}
        items={items}
        tripId={tripId}
        currentUserId={currentUserId}
        partnerId={partnerId}
        partnerName={partnerName}
        allCategories={allCategories}
        byCategory={byCategory}
        onFocusCategory={onFocusCategory}
        onClose={onClose}
      />
    </div>
  );
}

// ── Category card (grid tile) ────────────────────────────────────────────────

function CategoryCard({
  category,
  items,
  onOpen,
}: {
  category: CategoryRef;
  items: TripPackingItem[];
  onOpen: () => void;
}) {
  const meta = getCategoryMeta(category);
  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;
  const progress = total > 0 ? packed / total : 0;
  const allPacked = total > 0 && packed === total;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer select-none active:scale-95 transition-transform duration-150"
      style={{ minHeight: "160px" }}
      onClick={onOpen}
    >
      {/* Gradient bg */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: categoryGradient(meta, "to bottom right"), opacity: allPacked ? 0.6 : 1 }}
      />
      <div
        className="absolute inset-0 rounded-2xl"
        style={{ border: `1px solid ${meta.borderColor}` }}
      />

      {/* Content */}
      <div className="relative p-4 flex flex-col" style={{ minHeight: "160px" }}>
        {/* Icon */}
        <div className="flex-1 flex items-center justify-center pt-2">
          <div
            className="rounded-2xl p-2.5"
            style={{ backgroundColor: `${meta.iconColor}18` }}
          >
            {meta.icon(meta.iconColor)}
          </div>
        </div>

        {/* Category name */}
        <p className="text-white/85 text-sm font-medium mt-2 leading-tight">{category.name}</p>

        {/* Count + progress */}
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: allPacked && total > 0 ? "#34d399" : meta.iconColor }}
            >
              {packed}/{total}
            </span>
            {allPacked && total > 0 && (
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2.5 7l3 3 6-6" />
              </svg>
            )}
          </div>
          <div className="w-full h-1 rounded-full bg-white/10">
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: allPacked && total > 0 ? "#34d399" : meta.iconColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type AssignFilter = "all" | "mine" | "partner";

export function TripPackingList({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: allItems = [], isLoading } = useTripPacking(tripId);
  const { data: packingCategories = [] } = useTripPackingCategories(tripId);
  const { data: household } = useHouseholdMembers();
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const createCategory = useCreatePackingCategory(tripId);
  const bulkCreate = useBulkCreatePackingItems(tripId);
  const updatePackingItem = useUpdatePackingItem(tripId);
  const { data: deletedItems = [] } = useTripPackingDeleted(tripId);
  const { data: checkpoint } = useTripPackingCheckpoint(tripId);
  const saveCheckpoint = useSavePackingCheckpoint(tripId);
  const revertCheckpoint = useRevertPackingCheckpoint(tripId);

  const currentUserId = household?.currentUserId ?? null;
  const partner = household?.members.find((m) => !m.isCurrentUser);
  const partnerId = partner?.id ?? null;
  const partnerName = partner?.displayName ?? "Partner";

  const items = allItems.filter((item) => {
    if (assignFilter === "mine") return item.assigned_to === currentUserId;
    if (assignFilter === "partner") return item.assigned_to === partnerId;
    return true;
  });

  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;
  const anyPacked = allItems.some((i) => i.is_packed || i.packed_quantity > 0);

  const categoriesById = new Map(packingCategories.map((category) => [category.id, category]));
  const categories: CategoryRef[] = [...packingCategories, { id: null, name: "Other" }];

  // Build category map — seed all 8 defaults + persisted custom ones
  const byCategory: Record<string, TripPackingItem[]> = {};
  for (const category of categories) byCategory[categoryKey(category)] = [];
  for (const item of items) {
    const category = item.category_id ? categoriesById.get(item.category_id) : null;
    const key = category
      ? categoryKey(category)
      : categoryKey({ id: null, name: "Other" });
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(item);
  }

  const legacyCategories: CategoryRef[] = Object.keys(byCategory)
    .filter((key) => !categories.some((category) => categoryKey(category) === key))
    .map((key) => ({ id: null, name: key.replace("legacy:", "") }));
  const allCategories = [...categories, ...legacyCategories];

  const handleCategoryCreated = (name: string) => {
    const trimmed = name.trim();
    const existing = allCategories.find((category) => category.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (!trimmed || existing) {
      if (existing) setFocusedKey(categoryKey(existing));
      return;
    }
    createCategory.mutate({ name: trimmed }, { onSuccess: (category) => setFocusedKey(categoryKey(category)) });
  };

  const handleApplyPreset = async (preset: PackingPreset) => {
    const categoryByName = new Map(packingCategories.map((category) => [category.name.toLocaleLowerCase(), category]));
    const namesToCreate = [...new Set(preset.items.map((item) => item.category))]
      .filter((name) => !categoryByName.has(name.toLocaleLowerCase()));
    const createdCategories = await Promise.all(namesToCreate.map((name) => createCategory.mutateAsync({ name })));
    for (const category of createdCategories) categoryByName.set(category.name.toLocaleLowerCase(), category);
    bulkCreate.mutate(preset.items.map((item) => ({
      name: item.name,
      category_id: categoryByName.get(item.category.toLocaleLowerCase())?.id ?? null,
      quantity: item.quantity ?? 1,
    })));
    setPresetOpen(false);
  };

  const handleReturnSweep = () => {
    const packedItems = allItems.filter((i) => i.is_packed || i.packed_quantity > 0);
    if (packedItems.length === 0) return;
    const previous = packedItems.map((item) => ({ id: item.id, packed_quantity: item.packed_quantity, is_packed: item.is_packed }));
    Promise.all(
      packedItems.map((item) => updatePackingItem.mutateAsync({ id: item.id, packed_quantity: 0, is_packed: false })),
    ).then(() => {
      toast.success("Packing list reset for next trip", {
        icon: ToastIcons.success,
        duration: 4000,
        action: { label: "Undo", onClick: () => Promise.all(previous.map((item) => updatePackingItem.mutateAsync(item))) },
      });
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("text-sm font-medium", tc.textMuted)}>Packing List</h3>
            {total > 0 && (
              <p className="text-xs text-white/30 mt-0.5">{packed}/{total} packed</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
                  title="Packing checkpoint"
                  aria-label="Packing checkpoint"
                >
                  <History className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem onClick={() => saveCheckpoint.mutate()}>
                  <Save className="w-3.5 h-3.5 mr-2" />
                  Save checkpoint
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!checkpoint?.created_at}
                  onClick={() => revertCheckpoint.mutate()}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  {checkpoint?.created_at
                    ? `Revert to checkpoint (${formatDistanceToNow(new Date(checkpoint.created_at), { addSuffix: true })})`
                    : "Revert to checkpoint"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {deletedItems.length > 0 && (
              <button
                onClick={() => setDeletedOpen(true)}
                className="relative flex items-center text-white/40 hover:text-white/70 transition-colors"
                title="Deleted items"
                aria-label="Deleted items"
              >
                <Trash2 className="w-4 h-4" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-white/20 text-[9px] font-semibold flex items-center justify-center text-white/80">
                  {deletedItems.length}
                </span>
              </button>
            )}
            {anyPacked && (
              <button
                onClick={handleReturnSweep}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                title="Reset packed status for the next trip"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <button
              onClick={() => setAddCatOpen(true)}
              className={cn("flex items-center gap-1 text-sm", tc.text)}
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {/* Assignment filter */}
        {partnerId && allItems.length > 0 && (
          <div className="flex items-center gap-1.5">
            {([
              ["all", "All"],
              ["mine", "Mine"],
              ["partner", partnerName],
            ] as Array<[AssignFilter, string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAssignFilter(key)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  assignFilter === key ? cn(tc.bgSurface, tc.text, tc.border) : "text-white/40 border-white/10 hover:text-white/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Overall progress */}
        {total > 0 && (
          <div className="w-full bg-white/10 rounded-full h-1">
            <div
              className="bg-emerald-400 h-1 rounded-full transition-all duration-500"
              style={{ width: `${(packed / total) * 100}%` }}
            />
          </div>
        )}

        {/* Empty state — offer a starter preset instead of 8 empty tiles */}
        {!isLoading && allItems.length === 0 && (
          <button
            onClick={() => setPresetOpen(true)}
            className={cn("w-full flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm", tc.border, tc.textMuted)}
          >
            <Sparkles className="w-4 h-4" /> Start from a packing preset
          </button>
        )}

        {/* Grid — always show all categories */}
        {isLoading ? (
          <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {allCategories.map((category) => (
              <CategoryCard
                key={categoryKey(category)}
                category={category}
                items={byCategory[categoryKey(category)] ?? []}
                onOpen={() => setFocusedKey(categoryKey(category))}
              />
            ))}
          </div>
        )}

        <PresetPickerSheet open={presetOpen} onOpenChange={setPresetOpen} onSelect={handleApplyPreset} />

        {/* Add category sheet */}
        <AddCategorySheet
          open={addCatOpen}
          onOpenChange={setAddCatOpen}
          onConfirm={handleCategoryCreated}
        />

        <DeletedItemsSheet tripId={tripId} open={deletedOpen} onOpenChange={setDeletedOpen} />
      </div>

      {/* Focus panel overlay */}
      {focusedKey !== null && (
        <CategoryFocusPanel
          allCategories={allCategories}
          byCategory={byCategory}
          focusedKey={focusedKey}
          onFocusCategory={setFocusedKey}
          tripId={tripId}
          currentUserId={currentUserId}
          partnerId={partnerId}
          partnerName={partnerName}
          onClose={() => setFocusedKey(null)}
        />
      )}
    </>
  );
}

// ── Deleted items sheet (in-context packing recycle bin) ────────────────────

function DeletedItemsSheet({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tc = useThemeClasses();
  const { data: deletedItems = [], isLoading } = useTripPackingDeleted(tripId);
  const restoreItem = useRestorePackingItem(tripId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t max-h-[80vh] overflow-y-auto", tc.border, tc.bgPage)}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">Deleted items</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 pb-8">
          {isLoading && <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>}
          {!isLoading && deletedItems.length === 0 && (
            <p className={cn("text-sm text-center py-6", tc.textFaint)}>Nothing deleted from this trip's packing list</p>
          )}
          {deletedItems.map((item) => (
            <div
              key={item.id}
              className={cn("flex items-center gap-3 rounded-xl border p-3", tc.border)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85 truncate">{item.name}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {item.packing_category?.name ?? "Other"} · qty {item.quantity}
                  {item.deleted_at && ` · deleted ${formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}`}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => restoreItem.mutate(item.id)}
                disabled={restoreItem.isPending}
                className={cn("flex-shrink-0 border font-medium", tc.bgSurface, tc.text, tc.border)}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Add category sheet ───────────────────────────────────────────────────────

function AddCategorySheet({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (name: string) => void;
}) {
  const tc = useThemeClasses();
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setName("");
    onOpenChange(false);
  };

  const inputClass = cn("bg-white/5 border text-white placeholder:text-white/30", tc.border);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage)}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">Add category</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Category name</Label>
            <Input
              className={inputClass}
              placeholder="e.g. Sports gear, Baby stuff…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim()}
            className={cn("w-full", tc.bgSurface, tc.text, "border", tc.border)}
          >
            Add category
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Preset picker sheet ──────────────────────────────────────────────────────

function PresetPickerSheet({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (preset: PackingPreset) => void;
}) {
  const tc = useThemeClasses();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage)}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">Start from a preset</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 pb-8">
          {PACKING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className={cn("w-full text-left rounded-xl border p-3.5 bg-white/5 hover:bg-white/8 transition-colors", tc.border)}
            >
              <p className="text-sm font-medium text-white">{preset.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{preset.description}</p>
              <p className="text-xs text-white/25 mt-1">{preset.items.length} items</p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
