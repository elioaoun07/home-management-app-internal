"use client";

import OutfitSheet from "@/components/outfits/OutfitSheet";
import {
  useArchiveGarment,
  useDeleteGarment,
  useOutfits,
  useUpdateGarment,
} from "@/features/outfits/hooks";
import type { WardrobeItem } from "@/features/outfits/types";
import { useWardrobeImageUrls } from "@/features/outfits/useSignedUrls";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Archive, Shirt, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Props {
  item: WardrobeItem | null;
  onClose: () => void;
}

export default function GarmentDetailSheet({ item, onClose }: Props) {
  const tc = useThemeClasses();
  const [name, setName] = useState("");
  const [fitNote, setFitNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateGarment = useUpdateGarment();
  const archiveGarment = useArchiveGarment();
  const deleteGarment = useDeleteGarment();
  const { data: outfits = [] } = useOutfits();
  const { getUrl } = useWardrobeImageUrls([item?.cutout_path ?? item?.image_path]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setFitNote(item.fit_note ?? "");
      setConfirmDelete(false);
    }
  }, [item]);

  const usedInCount = useMemo(
    () =>
      item
        ? outfits.filter((o) => o.outfit_items.some((oi) => oi.item_id === item.id)).length
        : 0,
    [outfits, item],
  );

  if (!item) return null;
  const url = getUrl(item.cutout_path ?? item.image_path);
  const dirty = name.trim() !== item.name || (fitNote.trim() || null) !== item.fit_note;

  const handleSave = () => {
    if (!name.trim()) return;
    updateGarment.mutate({
      id: item.id,
      data: { name: name.trim(), fit_note: fitNote.trim() || null },
      previous: { name: item.name, fit_note: item.fit_note },
    });
    onClose();
  };

  return (
    <OutfitSheet
      open={!!item}
      onClose={onClose}
      title="Garment"
      icon={<Shirt className={cn("w-5 h-5", tc.text)} />}
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div
            className={cn(
              "w-28 h-36 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 p-2",
              tc.bgActive,
            )}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={item.name}
                decoding="async"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <Shirt className={cn("w-8 h-8", tc.textMuted)} />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn("w-full px-3 py-2.5 rounded-xl text-sm outline-none", tc.formInput)}
            />
            <div className="flex flex-wrap gap-1.5 text-[11px] text-white/50">
              <span className={cn("px-2 py-0.5 rounded-full capitalize", tc.pillBg)}>
                {item.slot}
              </span>
              {item.brand && (
                <span className={cn("px-2 py-0.5 rounded-full", tc.pillBg)}>{item.brand}</span>
              )}
              {item.size && (
                <span className={cn("px-2 py-0.5 rounded-full", tc.pillBg)}>{item.size}</span>
              )}
              {item.colors.map((c) => (
                <span key={c} className={cn("px-2 py-0.5 rounded-full capitalize", tc.pillBg)}>
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-white/40">
              Worn {item.times_worn}×
              {item.last_worn_at &&
                ` · last ${new Date(item.last_worn_at).toLocaleDateString()}`}
              {usedInCount > 0 && ` · in ${usedInCount} outfit${usedInCount > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <textarea
          value={fitNote}
          onChange={(e) => setFitNote(e.target.value)}
          placeholder="Fit note — “runs small, size up”"
          rows={2}
          className={cn("w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none", tc.formInput)}
        />

        {dirty && (
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] neo-gradient text-white"
          >
            Save changes
          </button>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              archiveGarment.mutate({ id: item.id, archived: !item.archived_at });
              onClose();
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
              tc.border,
              tc.bgHover,
              tc.text,
            )}
          >
            <Archive className="w-4 h-4" />
            {item.archived_at ? "Restore" : "Archive"}
          </button>
          <button
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              deleteGarment.mutate(item);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete
              ? usedInCount > 0
                ? `Delete (in ${usedInCount} outfit${usedInCount > 1 ? "s" : ""})?`
                : "Photos too — sure?"
              : "Delete"}
          </button>
        </div>
      </div>
    </OutfitSheet>
  );
}
