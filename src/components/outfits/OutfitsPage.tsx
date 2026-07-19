"use client";

import AddGarmentSheet from "@/components/outfits/AddGarmentSheet";
import GarmentDetailSheet from "@/components/outfits/GarmentDetailSheet";
import OutfitBuilder from "@/components/outfits/OutfitBuilder";
import OutfitsGallery from "@/components/outfits/OutfitsGallery";
import SizingProfileSheet from "@/components/outfits/SizingProfileSheet";
import WardrobeGrid from "@/components/outfits/WardrobeGrid";
import { useWardrobeItems } from "@/features/outfits/hooks";
import type { Outfit, WardrobeItem } from "@/features/outfits/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { instant, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Ruler, Shirt, SwatchBook } from "lucide-react";
import { useState } from "react";

type Tab = "wardrobe" | "outfits";

const TABS: { id: Tab; label: string; icon: typeof Shirt }[] = [
  { id: "wardrobe", label: "Wardrobe", icon: Shirt },
  { id: "outfits", label: "Outfits", icon: SwatchBook },
];

export default function OutfitsPage() {
  const tc = useThemeClasses();
  const prefersReduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>("wardrobe");
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<WardrobeItem | null>(null);
  const [builder, setBuilder] = useState<{ open: boolean; outfit?: Outfit }>({
    open: false,
  });

  const { data: items = [] } = useWardrobeItems();

  return (
    <div className="min-h-screen pb-24">
      {/* Segmented control + actions — sits below the global fixed header (pt-14, Hard Rule 16) */}
      <div className="px-4 pt-14 pb-3 flex items-center gap-2">
        <div
          className={cn(
            "flex-1 flex rounded-2xl p-1 relative",
            tc.tabsListBg,
          )}
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors",
                  active ? tc.text : "text-white/45",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="outfits-tab-pill"
                    transition={instant(prefersReduced, springs.snappy)}
                    className={cn("absolute inset-0 rounded-xl", tc.tabsTriggerActive)}
                  />
                )}
                <Icon className="relative w-4 h-4" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setProfileOpen(true)}
          aria-label="Sizing profile"
          className={cn(
            "p-2.5 rounded-xl border transition-all active:scale-95",
            tc.border,
            tc.bgHover,
          )}
        >
          <Ruler className={cn("w-4 h-4", tc.text)} />
        </button>
      </div>

      {tab === "wardrobe" ? (
        <WardrobeGrid
          onAdd={() => setAddOpen(true)}
          onOpenItem={(item) => setDetailItem(item)}
        />
      ) : (
        <OutfitsGallery
          onNew={() => setBuilder({ open: true })}
          onEdit={(outfit) => setBuilder({ open: true, outfit })}
          hasGarments={items.length > 0}
          onGoWardrobe={() => setTab("wardrobe")}
        />
      )}

      {/* Floating add button (wardrobe tab) */}
      {tab === "wardrobe" && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Add garment"
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl neo-gradient text-white shadow-2xl flex items-center justify-center transition-transform active:scale-90"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddGarmentSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <SizingProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <GarmentDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
      <OutfitBuilder
        open={builder.open}
        initialOutfit={builder.outfit}
        onClose={() => setBuilder({ open: false })}
      />
    </div>
  );
}
