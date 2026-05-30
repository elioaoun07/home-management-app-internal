"use client";

import {
  useCreatePackingItem,
  useDeletePackingItem,
  useTripPacking,
  useUpdatePackingItem,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { TripPackingItem } from "@/types/trips";
import { MoreHorizontal, Plus, Trash2, ChevronLeft, Pencil, X } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ToastIcons } from "@/lib/toastIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Category metadata ────────────────────────────────────────────────────────

type CategoryMeta = {
  gradient: string;
  iconColor: string;
  borderColor: string;
  icon: (color: string) => React.ReactNode;
};

const CATEGORY_META: Record<string, CategoryMeta> = {
  Documents: {
    gradient: "from-amber-500/35 via-amber-500/15 to-amber-500/5",
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
    gradient: "from-blue-500/35 via-blue-500/15 to-blue-500/5",
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
    gradient: "from-violet-500/35 via-violet-500/15 to-violet-500/5",
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
    gradient: "from-cyan-500/35 via-cyan-500/15 to-cyan-500/5",
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
    gradient: "from-rose-500/35 via-rose-500/15 to-rose-500/5",
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
    gradient: "from-emerald-500/35 via-emerald-500/15 to-emerald-500/5",
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
    gradient: "from-pink-500/35 via-pink-500/15 to-pink-500/5",
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
    gradient: "from-slate-400/30 via-slate-400/12 to-slate-400/4",
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
};

const PACKING_CATEGORIES = [
  "Documents", "Clothes", "Electronics", "Toiletries",
  "Health", "Money", "Accessories", "Other",
];

function getCategoryMeta(cat: string): CategoryMeta {
  return (
    CATEGORY_META[cat] ?? {
      gradient: "from-slate-400/30 via-slate-400/12 to-slate-400/4",
      iconColor: "#94a3b8",
      borderColor: "rgba(148,163,184,0.2)",
      icon: CATEGORY_META.Other.icon,
    }
  );
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
        className="w-10 text-center text-xs bg-white/10 border border-white/20 rounded text-white outline-none py-0.5"
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
        className="px-1.5 text-xs font-mono text-white/70 hover:text-white transition-colors min-w-[20px] text-center"
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

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  tripId,
  iconColor,
}: {
  item: TripPackingItem;
  tripId: string;
  iconColor: string;
}) {
  const updateItem = useUpdatePackingItem(tripId);
  const deleteItem = useDeletePackingItem(tripId);
  const [nameEdit, setNameEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);

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
    <div className={cn("flex items-center gap-3 py-3 border-b border-white/8 last:border-0 group")}>
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
            className="w-full text-sm bg-white/10 border border-white/20 rounded px-2 py-1 text-white outline-none"
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
              "text-sm cursor-text block truncate",
              isFullyPacked ? "line-through text-white/30" : "text-white/85",
            )}
          >
            {item.name}
          </span>
        )}
      </div>

      {/* Qty stepper */}
      <QtyControl
        value={item.quantity}
        onChange={(v) => updateItem.mutate({ id: item.id, quantity: v })}
      />

      {/* Delete */}
      <button
        onClick={() => deleteItem.mutate(item.id)}
        className="flex-shrink-0 p-1.5 text-white/25 hover:text-red-400 active:text-red-400 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Inline add row ───────────────────────────────────────────────────────────

function InlineAddRow({
  tripId,
  category,
  iconColor,
}: {
  tripId: string;
  category: string;
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
    createItem.mutate(
      { name: trimmed, category: category === "Other" ? null : category, quantity: qty },
      {
        onSuccess: () => {
          setName("");
          setQty(1);
          inputRef.current?.focus();
        },
      },
    );
  }, [name, qty, category, createItem]);

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center gap-2.5 py-3 text-white/35 hover:text-white/60 transition-colors text-sm"
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
        className="flex-1 min-w-0 text-sm bg-transparent text-white placeholder:text-white/30 outline-none border-b border-white/20 pb-0.5"
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
        disabled={!name.trim() || createItem.isPending}
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
  items,
  tripId,
  open,
  onOpenChange,
}: {
  category: string;
  items: TripPackingItem[];
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tc = useThemeClasses();
  const updateItem = useUpdatePackingItem(tripId);
  const [newName, setNewName] = useState(category);
  const [saving, setSaving] = useState(false);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === category) { onOpenChange(false); return; }
    setSaving(true);
    try {
      await Promise.all(
        items.map((item) => updateItem.mutateAsync({ id: item.id, category: trimmed === "Other" ? null : trimmed })),
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    setSaving(true);
    try {
      await Promise.all(
        items.map((item) => updateItem.mutateAsync({ id: item.id, category: null })),
      );
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

// ── Category focus panel (full-screen overlay) ───────────────────────────────

function CategoryFocusPanel({
  category,
  items,
  tripId,
  onClose,
}: {
  category: string;
  items: TripPackingItem[];
  tripId: string;
  onClose: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const meta = getCategoryMeta(category);
  // Track items added while the panel was open for the deferred toast
  const initialCountRef = useRef(items.length);

  const handleClose = () => {
    const added = items.length - initialCountRef.current;
    if (added > 0) {
      toast.success(
        added === 1 ? "1 item added" : `${added} items added`,
        { icon: ToastIcons.create, duration: 3000 },
      );
    }
    onClose();
  };
  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;
  const allPacked = total > 0 && packed === total;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(8,8,16,0.96)" }}
      >
        {/* Subtle gradient tint behind header */}
        <div
          className={cn("absolute inset-x-0 top-0 h-48 bg-gradient-to-b pointer-events-none", meta.gradient)}
          style={{ opacity: 0.45 }}
        />

        {/* Header */}
        <div className="relative flex-shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ color: meta.iconColor }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base font-semibold text-white leading-tight">{category}</h2>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: allPacked && total > 0 ? "#34d399" : meta.iconColor }}
                >
                  {packed}/{total} packed
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
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
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/10 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
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

        {/* Icon row */}
        <div className="relative flex-shrink-0 flex justify-center py-4">
          <div
            className="rounded-3xl p-4"
            style={{ backgroundColor: `${meta.iconColor}12`, border: `1px solid ${meta.iconColor}20` }}
          >
            {meta.icon(meta.iconColor)}
          </div>
        </div>

        {/* Items list */}
        <div className="relative flex-1 overflow-y-auto px-4 pb-safe-area-inset-bottom">
          {items.length === 0 && (
            <p className="text-center text-sm text-white/25 py-6">No items yet — add one below</p>
          )}
          {items.map((item) => (
            <ItemRow key={item.id} item={item} tripId={tripId} iconColor={meta.iconColor} />
          ))}
          <InlineAddRow tripId={tripId} category={category} iconColor={meta.iconColor} />
        </div>
      </div>

      {editOpen && (
        <RenameCategorySheet
          category={category}
          items={items}
          tripId={tripId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

// ── Category card (grid tile) ────────────────────────────────────────────────

function CategoryCard({
  category,
  items,
  onOpen,
}: {
  category: string;
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
        className={cn("absolute inset-0 bg-gradient-to-br", meta.gradient)}
        style={{ opacity: allPacked ? 0.6 : 1 }}
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
        <p className="text-white/85 text-sm font-medium mt-2 leading-tight">{category}</p>

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

export function TripPackingList({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: items = [], isLoading } = useTripPacking(tripId);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;

  // Build category map — seed all 8 defaults + any local extras
  const byCategory: Record<string, TripPackingItem[]> = {};
  for (const cat of PACKING_CATEGORIES) byCategory[cat] = [];
  for (const cat of extraCategories) if (!byCategory[cat]) byCategory[cat] = [];
  for (const item of items) {
    const key = item.category ?? "Other";
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(item);
  }

  // Defaults first, then persisted custom ones (have items), then local extras with no items yet
  const allCategories = [
    ...PACKING_CATEGORIES,
    ...Object.keys(byCategory).filter((c) => !PACKING_CATEGORIES.includes(c)),
  ];

  const handleCategoryCreated = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // If it's not already visible, add to local extras so the card appears
    if (!allCategories.includes(trimmed)) {
      setExtraCategories((prev) => [...prev, trimmed]);
    }
    setFocusedCategory(trimmed);
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
          <button
            onClick={() => setAddCatOpen(true)}
            className={cn("flex items-center gap-1 text-sm", tc.text)}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Overall progress */}
        {total > 0 && (
          <div className="w-full bg-white/10 rounded-full h-1">
            <div
              className="bg-emerald-400 h-1 rounded-full transition-all duration-500"
              style={{ width: `${(packed / total) * 100}%` }}
            />
          </div>
        )}

        {/* Grid — always show all categories */}
        {isLoading ? (
          <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {allCategories.map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                items={byCategory[cat] ?? []}
                onOpen={() => setFocusedCategory(cat)}
              />
            ))}
          </div>
        )}

        {/* Add category sheet */}
        <AddCategorySheet
          open={addCatOpen}
          onOpenChange={setAddCatOpen}
          onConfirm={handleCategoryCreated}
        />
      </div>

      {/* Focus panel overlay */}
      {focusedCategory !== null && (
        <CategoryFocusPanel
          category={focusedCategory}
          items={byCategory[focusedCategory] ?? []}
          tripId={tripId}
          onClose={() => setFocusedCategory(null)}
        />
      )}
    </>
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
