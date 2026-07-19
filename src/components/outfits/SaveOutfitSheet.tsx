"use client";

import OutfitSheet from "@/components/outfits/OutfitSheet";
import { useSaveOutfit, useUpdateOutfit } from "@/features/outfits/hooks";
import {
  slotMapToItems,
  type Outfit,
  type SlotMap,
} from "@/features/outfits/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { SwatchBook } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  slotMap: SlotMap;
  editing?: Outfit;
}

export default function SaveOutfitSheet({
  open,
  onClose,
  onSaved,
  slotMap,
  editing,
}: Props) {
  const tc = useThemeClasses();
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");

  const saveOutfit = useSaveOutfit();
  const updateOutfit = useUpdateOutfit();
  const pending = saveOutfit.isPending || updateOutfit.isPending;

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setOccasion(editing?.occasion_hint ?? "");
    }
  }, [open, editing]);

  const handleSave = async () => {
    const items = slotMapToItems(slotMap);
    if (!name.trim() || items.length === 0) return;
    try {
      if (editing) {
        await updateOutfit.mutateAsync({
          id: editing.id,
          data: { name: name.trim(), occasion_hint: occasion.trim() || null, items },
          previous: {
            name: editing.name,
            occasion_hint: editing.occasion_hint,
            items: editing.outfit_items.map((oi) => ({
              slot: oi.slot,
              item_id: oi.item_id,
            })),
          },
        });
      } else {
        await saveOutfit.mutateAsync({
          name: name.trim(),
          occasion_hint: occasion.trim() || null,
          items,
        });
      }
      onSaved();
    } catch {
      // Error toast already shown by the mutation hook; keep the sheet open.
    }
  };

  return (
    <OutfitSheet
      open={open}
      onClose={onClose}
      title={editing ? "Update Outfit" : "Save Outfit"}
      icon={<SwatchBook className={cn("w-5 h-5", tc.text)} />}
    >
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — “Friday casual”"
          autoFocus
          className={cn("w-full px-3 py-3 rounded-xl text-sm outline-none", tc.formInput)}
        />
        <input
          type="text"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Occasion — “work”, “date night” (optional)"
          className={cn("w-full px-3 py-3 rounded-xl text-sm outline-none", tc.formInput)}
        />
        <button
          onClick={handleSave}
          disabled={!name.trim() || pending}
          className={cn(
            "w-full py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] neo-gradient text-white",
            (!name.trim() || pending) && "opacity-50",
          )}
        >
          {pending ? "Saving…" : editing ? "Update outfit" : "Save outfit"}
        </button>
      </div>
    </OutfitSheet>
  );
}
