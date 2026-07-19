"use client";

import { useWardrobeItems } from "@/features/outfits/hooks";
import { SLOTS, type Slot, type WardrobeItem } from "@/features/outfits/types";
import { useWardrobeImageUrls } from "@/features/outfits/useSignedUrls";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { instant, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Archive, Shirt } from "lucide-react";
import { useMemo, useState } from "react";

const SLOT_LABELS: Record<Slot, string> = {
  headwear: "Headwear",
  top: "Tops",
  bottom: "Bottoms",
  shoes: "Shoes",
  outerwear: "Outerwear",
  accessory: "Accessories",
};

interface Props {
  onAdd: () => void;
  onOpenItem: (item: WardrobeItem) => void;
}

export default function WardrobeGrid({ onAdd, onOpenItem }: Props) {
  const tc = useThemeClasses();
  const prefersReduced = useReducedMotion();
  const [slotFilter, setSlotFilter] = useState<Slot | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: items = [], isLoading } = useWardrobeItems(showArchived);

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (slotFilter ? i.slot === slotFilter : true) &&
          (showArchived ? true : !i.archived_at),
      ),
    [items, slotFilter, showArchived],
  );

  const { getUrl } = useWardrobeImageUrls(
    visible.map((i) => i.cutout_path ?? i.image_path),
  );

  return (
    <div className="px-4 space-y-3">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        <FilterChip
          active={slotFilter === null}
          label="All"
          onClick={() => setSlotFilter(null)}
        />
        {SLOTS.map((slot) => (
          <FilterChip
            key={slot}
            active={slotFilter === slot}
            label={SLOT_LABELS[slot]}
            onClick={() => setSlotFilter(slotFilter === slot ? null : slot)}
          />
        ))}
        <FilterChip
          active={showArchived}
          label="Archived"
          icon={<Archive className="w-3 h-3" />}
          onClick={() => setShowArchived((v) => !v)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={cn("aspect-[3/4] rounded-2xl animate-pulse", tc.bgActive)}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <button
          onClick={onAdd}
          className={cn(
            "w-full py-14 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all active:scale-[0.99]",
            tc.dashedBorder,
          )}
        >
          <Shirt className={cn("w-9 h-9", tc.textMuted)} />
          <div className="text-center">
            <p className={cn("text-sm font-semibold", tc.text)}>
              {slotFilter || showArchived ? "Nothing here yet" : "Your wardrobe is empty"}
            </p>
            <p className="text-xs text-white/40 mt-1">
              Photograph a garment to digitize it
            </p>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visible.map((item, index) => {
            const url = getUrl(item.cutout_path ?? item.image_path);
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={instant(prefersReduced, {
                  ...springs.gentle,
                  delay: Math.min(index * 0.02, 0.2),
                })}
                onClick={() => onOpenItem(item)}
                className={cn(
                  "relative aspect-[3/4] rounded-2xl neo-card overflow-hidden flex items-center justify-center p-2",
                  item.archived_at && "opacity-50",
                )}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={item.name}
                    decoding="async"
                    loading="lazy"
                    draggable={false}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Shirt className={cn("w-8 h-8", tc.textMuted)} />
                )}
                <span className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-[10px] font-medium text-white/80 bg-gradient-to-t from-black/60 to-transparent text-left truncate">
                  {item.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95",
        active
          ? cn(tc.tabsTriggerActive, tc.text, "border-transparent")
          : cn(tc.pillBg, tc.border, "text-white/55"),
      )}
    >
      {icon}
      {label}
    </button>
  );
}
