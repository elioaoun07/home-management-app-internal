"use client";

import OutfitSheet from "@/components/outfits/OutfitSheet";
import {
  useSaveWardrobeProfile,
  useWardrobeProfile,
} from "@/features/outfits/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Ruler } from "lucide-react";
import { useEffect, useState } from "react";

const SIZE_FIELDS = ["top", "bottom", "shoes"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SizingProfileSheet({ open, onClose }: Props) {
  const tc = useThemeClasses();
  const { data: profile } = useWardrobeProfile();
  const saveProfile = useSaveWardrobeProfile();

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setHeight(profile?.height_cm != null ? String(profile.height_cm) : "");
      setWeight(profile?.weight_kg != null ? String(profile.weight_kg) : "");
      setSizes(profile?.sizes ?? {});
      setNotes(profile?.notes ?? "");
    }
  }, [open, profile]);

  const parseNum = (v: string): number | null => {
    const n = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleSave = () => {
    saveProfile.mutate({
      data: {
        height_cm: parseNum(height),
        weight_kg: parseNum(weight),
        sizes: Object.fromEntries(
          Object.entries(sizes).filter(([, v]) => v.trim().length > 0),
        ),
        notes: notes.trim() || null,
      },
      previous: profile
        ? {
            height_cm: profile.height_cm,
            weight_kg: profile.weight_kg,
            sizes: profile.sizes,
            notes: profile.notes,
          }
        : undefined,
    });
    onClose();
  };

  return (
    <OutfitSheet
      open={open}
      onClose={onClose}
      title="Sizing Profile"
      icon={<Ruler className={cn("w-5 h-5", tc.text)} />}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Hard Rule 19: decimal inputs are text + inputMode, never type=number */}
          <LabeledInput
            label="Height (cm)"
            value={height}
            onChange={setHeight}
            decimal
          />
          <LabeledInput
            label="Weight (kg)"
            value={weight}
            onChange={setWeight}
            decimal
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SIZE_FIELDS.map((f) => (
            <LabeledInput
              key={f}
              label={`${f[0].toUpperCase()}${f.slice(1)} size`}
              value={sizes[f] ?? ""}
              onChange={(v) => setSizes((prev) => ({ ...prev, [f]: v }))}
            />
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Fit notes — “prefer loose tops”"
          rows={2}
          className={cn("w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none", tc.formInput)}
        />

        <button
          onClick={handleSave}
          disabled={saveProfile.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] neo-gradient text-white"
        >
          Save profile
        </button>
      </div>
    </OutfitSheet>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
}) {
  const tc = useThemeClasses();
  return (
    <label className="space-y-1 block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        {label}
      </span>
      <input
        type="text"
        inputMode={decimal ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full px-3 py-2.5 rounded-xl text-sm outline-none", tc.formInput)}
      />
    </label>
  );
}
