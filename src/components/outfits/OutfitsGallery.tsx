"use client";

import { useDeleteOutfit, useOutfits, useWardrobeItems } from "@/features/outfits/hooks";
import {
  DOLL_SLOTS,
  type Outfit,
  type WardrobeItem,
} from "@/features/outfits/types";
import { useWardrobeImageUrls } from "@/features/outfits/useSignedUrls";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { instant, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, SwatchBook, Trash2 } from "lucide-react";
import { useMemo } from "react";

interface Props {
  onNew: () => void;
  onEdit: (outfit: Outfit) => void;
  hasGarments: boolean;
  onGoWardrobe: () => void;
}

export default function OutfitsGallery({
  onNew,
  onEdit,
  hasGarments,
  onGoWardrobe,
}: Props) {
  const tc = useThemeClasses();
  const prefersReduced = useReducedMotion();
  const { data: outfits = [], isLoading } = useOutfits();
  const { data: items = [] } = useWardrobeItems(true);
  const deleteOutfit = useDeleteOutfit();

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );
  const { getUrl } = useWardrobeImageUrls(
    items.map((i) => i.cutout_path ?? i.image_path),
  );

  return (
    <div className="px-4 space-y-3">
      <button
        onClick={hasGarments ? onNew : onGoWardrobe}
        className={cn(
          "w-full py-4 rounded-2xl border-2 flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-[0.99]",
          tc.dashedBorder,
          tc.text,
        )}
      >
        <Plus className="w-4 h-4" />
        {hasGarments ? "Build a new outfit" : "Add garments first"}
      </button>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("h-56 rounded-2xl animate-pulse", tc.bgActive)} />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <SwatchBook className={cn("w-9 h-9", tc.textMuted)} />
          <p className="text-xs text-white/40 max-w-[220px]">
            Saved outfits appear here — swipe garments in the builder and save your
            favorite combinations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {outfits.map((outfit, index) => (
            <motion.div
              key={outfit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={instant(prefersReduced, {
                ...springs.gentle,
                delay: Math.min(index * 0.03, 0.2),
              })}
              className="relative"
            >
              <button
                onClick={() => onEdit(outfit)}
                className="w-full rounded-2xl neo-card overflow-hidden p-3 flex flex-col items-stretch gap-2 text-left"
              >
                <MiniDoll outfit={outfit} itemById={itemById} getUrl={getUrl} />
                <div>
                  <p className={cn("text-sm font-semibold truncate", tc.text)}>
                    {outfit.name}
                  </p>
                  <p className="text-[11px] text-white/40 truncate">
                    {outfit.occasion_hint || `${outfit.outfit_items.length} pieces`}
                    {outfit.times_worn > 0 && ` · worn ${outfit.times_worn}×`}
                  </p>
                </div>
              </button>
              <button
                onClick={() => deleteOutfit.mutate(outfit)}
                aria-label={`Delete ${outfit.name}`}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-white/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Thumbnail = the same stacked-slot composition at card scale. */
function MiniDoll({
  outfit,
  itemById,
  getUrl,
}: {
  outfit: Outfit;
  itemById: Map<string, WardrobeItem>;
  getUrl: (path: string | null | undefined) => string | null;
}) {
  const bySlot = new Map(outfit.outfit_items.map((oi) => [oi.slot, oi.item_id]));
  return (
    <div className="h-40 flex flex-col items-center">
      {DOLL_SLOTS.map((slot) => {
        const itemId = bySlot.get(slot);
        const item = itemId ? itemById.get(itemId) : undefined;
        const url = item ? getUrl(item.cutout_path ?? item.image_path) : null;
        const height =
          slot === "headwear"
            ? "h-[12%]"
            : slot === "shoes"
              ? "h-[20%]"
              : "h-[34%]";
        return (
          <div key={slot} className={cn("w-full flex items-center justify-center", height)}>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={item?.name ?? ""}
                decoding="async"
                loading="lazy"
                draggable={false}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
