"use client";

// The paper doll. A fixed column of stacked SlotSwiper rows — swiping a body
// region literally swaps that garment. Outerwear/accessory are overlay layers
// picked via chips and crossfaded with a decode-before-swap guard so a layer
// never flashes empty.

import OutfitSheet from "@/components/outfits/OutfitSheet";
import SaveOutfitSheet from "@/components/outfits/SaveOutfitSheet";
import SlotSwiper from "@/components/outfits/SlotSwiper";
import { useWardrobeItems } from "@/features/outfits/hooks";
import {
  DOLL_SLOTS,
  EMPTY_SLOT_MAP,
  outfitToSlotMap,
  type Outfit,
  type OverlaySlot,
  type SlotMap,
  type WardrobeItem,
} from "@/features/outfits/types";
import { useWardrobeImageUrls } from "@/features/outfits/useSignedUrls";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { instant, layerSwap, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Shirt, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const DOLL_ROW_HEIGHTS: Record<(typeof DOLL_SLOTS)[number], string> = {
  headwear: "h-[12%]",
  top: "h-[34%]",
  bottom: "h-[34%]",
  shoes: "h-[20%]",
};

const DOLL_LABELS: Record<(typeof DOLL_SLOTS)[number], string> = {
  headwear: "Headwear",
  top: "Tops",
  bottom: "Bottoms",
  shoes: "Shoes",
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialOutfit?: Outfit;
}

export default function OutfitBuilder({ open, onClose, initialOutfit }: Props) {
  const tc = useThemeClasses();
  const prefersReduced = useReducedMotion();
  const { data: items = [] } = useWardrobeItems();

  const [slotMap, setSlotMap] = useState<SlotMap>(EMPTY_SLOT_MAP);
  const [overlayPicker, setOverlayPicker] = useState<OverlaySlot | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSlotMap(initialOutfit ? outfitToSlotMap(initialOutfit) : EMPTY_SLOT_MAP);
      setOverlayPicker(null);
      setSaveOpen(false);
    }
  }, [open, initialOutfit]);

  const bySlot = useMemo(() => {
    const map = new Map<string, WardrobeItem[]>();
    for (const item of items) {
      const list = map.get(item.slot) ?? [];
      list.push(item);
      map.set(item.slot, list);
    }
    return map;
  }, [items]);

  const { getUrl } = useWardrobeImageUrls(
    items.map((i) => i.cutout_path ?? i.image_path),
  );

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  const selectionCount = Object.values(slotMap).filter(Boolean).length;

  if (!open || typeof document === "undefined") return null;

  const outerwearItem = slotMap.outerwear ? itemById.get(slotMap.outerwear) : undefined;
  const accessoryItem = slotMap.accessory ? itemById.get(slotMap.accessory) : undefined;

  return createPortal(
    <div className={cn("fixed inset-0 z-[9990] flex flex-col", tc.bgPage)}>
      {/* Header (own fixed-height header — content below is the flex body, no overlap) */}
      <div className={cn("flex items-center justify-between px-4 h-14 shrink-0 border-b", tc.border)}>
        <button
          onClick={onClose}
          aria-label="Close builder"
          className={cn("p-2 -ml-2 rounded-lg transition-colors", tc.hoverBgSubtle)}
        >
          <X className={cn("w-5 h-5", tc.headerText)} />
        </button>
        <h2 className={cn("text-base font-semibold", tc.text)}>
          {initialOutfit ? initialOutfit.name : "New Outfit"}
        </h2>
        <button
          onClick={() => setSaveOpen(true)}
          disabled={selectionCount === 0}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold neo-gradient text-white transition-all active:scale-95",
            selectionCount === 0 && "opacity-40",
          )}
        >
          <Check className="w-4 h-4" />
          Save
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Shirt className={cn("w-10 h-10", tc.textMuted)} />
          <p className={cn("text-sm font-semibold", tc.text)}>No garments yet</p>
          <p className="text-xs text-white/40">
            Digitize a few clothes in the Wardrobe tab first — then come dress your doll.
          </p>
        </div>
      ) : (
        <>
          {/* Overlay chips */}
          <div className="flex gap-2 px-4 py-2.5 shrink-0">
            {(["outerwear", "accessory"] as const).map((slot) => {
              const selected = slotMap[slot];
              const selectedItem = selected ? itemById.get(selected) : undefined;
              const active = overlayPicker === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setOverlayPicker(active ? null : slot)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all active:scale-95",
                    active || selected
                      ? cn(tc.tabsTriggerActive, tc.text, "border-transparent")
                      : cn(tc.pillBg, tc.border, "text-white/55"),
                  )}
                >
                  {slot}
                  {selectedItem && (
                    <span className="max-w-[80px] truncate text-white/70">
                      · {selectedItem.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Overlay mini-picker */}
          <AnimatePresence initial={false}>
            {overlayPicker && (
              <motion.div
                key={overlayPicker}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={instant(prefersReduced, springs.gentle)}
                className="shrink-0 overflow-hidden"
              >
                <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
                  <MiniPickCard
                    label="None"
                    selected={slotMap[overlayPicker] === null}
                    onClick={() =>
                      setSlotMap((m) => ({ ...m, [overlayPicker]: null }))
                    }
                  />
                  {(bySlot.get(overlayPicker) ?? []).map((item) => (
                    <MiniPickCard
                      key={item.id}
                      label={item.name}
                      url={getUrl(item.cutout_path ?? item.image_path)}
                      selected={slotMap[overlayPicker] === item.id}
                      onClick={() =>
                        setSlotMap((m) => ({
                          ...m,
                          [overlayPicker]:
                            m[overlayPicker] === item.id ? null : item.id,
                        }))
                      }
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The doll */}
          <div className="flex-1 relative px-2 pb-4 min-h-0">
            <div className="h-full max-w-sm mx-auto relative">
              <div className="h-full flex flex-col">
                {DOLL_SLOTS.map((slot) => (
                  <SlotSwiper
                    key={slot}
                    label={DOLL_LABELS[slot]}
                    items={bySlot.get(slot) ?? []}
                    selectedId={slotMap[slot]}
                    onSelect={(id) => setSlotMap((m) => ({ ...m, [slot]: id }))}
                    getUrl={getUrl}
                    className={DOLL_ROW_HEIGHTS[slot]}
                  />
                ))}
              </div>

              {/* Outerwear overlay — layered above the top region */}
              <div className="absolute top-[10%] right-1 h-[30%] w-[34%] pointer-events-none z-10">
                <OverlayLayer
                  item={outerwearItem}
                  getUrl={getUrl}
                  className="rotate-6"
                />
              </div>
              {/* Accessory badge — top-right corner */}
              <div className="absolute top-1 right-1 h-[14%] w-[20%] pointer-events-none z-10">
                <OverlayLayer item={accessoryItem} getUrl={getUrl} />
              </div>
            </div>
          </div>
        </>
      )}

      <SaveOutfitSheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaved={() => {
          setSaveOpen(false);
          onClose();
        }}
        slotMap={slotMap}
        editing={initialOutfit}
      />
    </div>,
    document.body,
  );
}

/** Crossfades overlay garments; swaps only after the incoming image decodes. */
function OverlayLayer({
  item,
  getUrl,
  className,
}: {
  item: WardrobeItem | undefined;
  getUrl: (path: string | null | undefined) => string | null;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const url = item ? getUrl(item.cutout_path ?? item.image_path) : null;
  const [ready, setReady] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!item || !url) {
      setReady(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const commit = () => {
      if (!cancelled) setReady({ id: item.id, url });
    };
    img.decode().then(commit).catch(commit);
    return () => {
      cancelled = true;
    };
  }, [item, url]);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {ready && (
        <motion.div
          key={ready.id}
          {...layerSwap}
          transition={instant(prefersReduced, springs.layer)}
          className={cn("w-full h-full flex items-start justify-end", className)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ready.url}
            alt={item?.name ?? ""}
            draggable={false}
            className="max-w-full max-h-full object-contain drop-shadow-lg"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MiniPickCard({
  label,
  url,
  selected,
  onClick,
}: {
  label: string;
  url?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 w-16 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-1 transition-all active:scale-95",
        selected ? cn(tc.ringSelectionStrong, "border-transparent") : tc.border,
        tc.bgHover,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          decoding="async"
          draggable={false}
          className="max-w-full max-h-[70%] object-contain"
        />
      ) : null}
      <span className="text-[9px] text-white/60 truncate w-full text-center">{label}</span>
    </button>
  );
}
