"use client";

// 3-step digitize flow: photo → on-device background removal → tags.
// Background removal is best-effort: any failure falls back to "Keep original"
// and the module stays fully usable (design doc §5 step 4).

import OutfitSheet from "@/components/outfits/OutfitSheet";
import {
  useCreateGarment,
  useUploadGarmentImages,
} from "@/features/outfits/hooks";
import {
  FORMALITIES,
  SEASONS,
  SLOTS,
  type Formality,
  type Season,
  type Slot,
} from "@/features/outfits/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  removeGarmentBackground,
  type BgRemovalProgress,
} from "@/lib/backgroundRemoval";
import { instant, layerSwap, springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Image as ImageIcon, Shirt, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Step = "capture" | "processing" | "approve" | "tags";

const COLOR_CHOICES: { name: string; className: string }[] = [
  { name: "black", className: "bg-black" },
  { name: "white", className: "bg-white" },
  { name: "gray", className: "bg-gray-400" },
  { name: "navy", className: "bg-blue-950" },
  { name: "blue", className: "bg-blue-500" },
  { name: "green", className: "bg-green-600" },
  { name: "olive", className: "bg-lime-800" },
  { name: "yellow", className: "bg-yellow-400" },
  { name: "orange", className: "bg-orange-500" },
  { name: "red", className: "bg-red-600" },
  { name: "pink", className: "bg-pink-400" },
  { name: "purple", className: "bg-purple-500" },
  { name: "brown", className: "bg-amber-800" },
  { name: "beige", className: "bg-amber-200" },
];

/** Neutral checkerboard so cutout transparency is visible on any theme. */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(rgba(255,255,255,0.12) 0% 25%, rgba(255,255,255,0.04) 0% 50%)",
  backgroundSize: "16px 16px",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddGarmentSheet({ open, onClose }: Props) {
  const tc = useThemeClasses();
  const prefersReduced = useReducedMotion();

  const [step, setStep] = useState<Step>("capture");
  const [original, setOriginal] = useState<File | null>(null);
  const [cutout, setCutout] = useState<File | null>(null);
  const [useCutout, setUseCutout] = useState(true);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<BgRemovalProgress | null>(null);
  const [removalFailed, setRemovalFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  // Tag form
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [season, setSeason] = useState<Season[]>([]);
  const [formality, setFormality] = useState<Formality | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createGarment = useCreateGarment();
  const uploadImages = useUploadGarmentImages();
  const saving = createGarment.isPending || uploadImages.isPending;

  // Reset on open; revoke object URLs on unmount/close.
  useEffect(() => {
    if (!open) return;
    setStep("capture");
    setOriginal(null);
    setCutout(null);
    setUseCutout(true);
    setProgress(null);
    setRemovalFailed(false);
    setError(null);
    setPendingItemId(null);
    setName("");
    setSlot(null);
    setBrand("");
    setSize("");
    setColors([]);
    setSeason([]);
    setFormality(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    };
  }, [originalUrl, cutoutUrl]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setStep("processing");
    setProgress(null);
    setRemovalFailed(false);

    try {
      const { compressWardrobeImage } = await import("@/lib/wardrobeImage");
      const compressed = await compressWardrobeImage(file, {
        maxDim: 1400,
        maxSizeKB: 150,
        fileName: "original.webp",
      });
      setOriginal(compressed);
      setOriginalUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(compressed);
      });

      try {
        const cut = await removeGarmentBackground(compressed, setProgress);
        setCutout(cut);
        setCutoutUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(cut);
        });
        setUseCutout(true);
      } catch {
        setCutout(null);
        setCutoutUrl(null);
        setUseCutout(false);
        setRemovalFailed(true);
      }
      setStep("approve");
    } catch {
      setError("Could not process the photo. Try again.");
      setStep("capture");
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !slot || !original) return;
    setError(null);
    try {
      // Item row first, images second — an image failure keeps the item and
      // surfaces a retry, never an orphaned upload (design doc §5 step 5).
      let itemId = pendingItemId;
      if (!itemId) {
        const { item } = await createGarment.mutateAsync({
          name: name.trim(),
          slot,
          brand: brand.trim() || null,
          size: size.trim() || null,
          colors,
          season,
          formality,
        });
        itemId = item.id;
        setPendingItemId(item.id);
      }
      await uploadImages.mutateAsync({
        itemId,
        original,
        cutout: useCutout && cutout ? cutout : undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — tap Save to retry the photo upload.`
          : "Save failed — tap Save to retry.",
      );
    }
  };

  const downloadPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <OutfitSheet
      open={open}
      onClose={onClose}
      title={
        step === "capture"
          ? "Add Garment"
          : step === "processing"
            ? "Cutting it out…"
            : step === "approve"
              ? "Review Cutout"
              : "Describe It"
      }
      icon={<Shirt className={cn("w-5 h-5", tc.text)} />}
    >
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {error && (
        <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {step === "capture" && (
          <motion.div
            key="capture"
            {...layerSwap}
            transition={instant(prefersReduced, springs.gentle)}
            className="space-y-2"
          >
            <p className="text-xs text-white/40 text-center pb-1">
              Lay the garment flat on a plain, contrasting surface
            </p>
            <CaptureButton
              icon={<Camera className={cn("w-5 h-5", tc.text)} />}
              title="Take Photo"
              subtitle="Rear camera, top-down"
              onClick={() => cameraInputRef.current?.click()}
            />
            <CaptureButton
              icon={<ImageIcon className={cn("w-5 h-5", tc.text)} />}
              title="Choose from Gallery"
              subtitle="Select an existing photo"
              onClick={() => galleryInputRef.current?.click()}
            />
          </motion.div>
        )}

        {step === "processing" && (
          <motion.div
            key="processing"
            {...layerSwap}
            transition={instant(prefersReduced, springs.gentle)}
            className="flex flex-col items-center gap-3 py-10"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full border-2 animate-spin",
                tc.border,
                "border-t-transparent",
              )}
            />
            <p className="text-sm text-white/60">
              {downloadPct !== null ? `Preparing model… ${downloadPct}%` : "Removing background…"}
            </p>
            <p className="text-[11px] text-white/35 text-center max-w-[240px]">
              First use downloads a ~40 MB model once, then it&apos;s cached — everything
              runs on your device.
            </p>
          </motion.div>
        )}

        {step === "approve" && (
          <motion.div
            key="approve"
            {...layerSwap}
            transition={instant(prefersReduced, springs.gentle)}
            className="space-y-3"
          >
            {removalFailed && (
              <p className="text-xs text-amber-300/80 bg-amber-500/10 rounded-xl px-3 py-2 text-center">
                Couldn&apos;t cut this one out — you can keep the original photo.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <ApproveCard
                label="Original"
                url={originalUrl}
                selected={!useCutout}
                onClick={() => setUseCutout(false)}
              />
              <ApproveCard
                label="Cutout"
                url={cutoutUrl}
                selected={useCutout && !!cutout}
                disabled={!cutout}
                checker
                onClick={() => cutout && setUseCutout(true)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("capture")}
                className={cn(
                  "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
                  tc.border,
                  tc.bgHover,
                  tc.text,
                )}
              >
                Retake
              </button>
              <button
                onClick={() => setStep("tags")}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 neo-gradient text-white"
              >
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  {useCutout && cutout ? "Use cutout" : "Keep original"}
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {step === "tags" && (
          <motion.div
            key="tags"
            {...layerSwap}
            transition={instant(prefersReduced, springs.gentle)}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-20 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={useCutout && cutout ? CHECKERBOARD : undefined}
              >
                {(useCutout ? (cutoutUrl ?? originalUrl) : originalUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(useCutout ? (cutoutUrl ?? originalUrl) : originalUrl)!}
                    alt="Garment"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name it — “White linen shirt”"
                autoFocus
                className={cn(
                  "flex-1 px-3 py-3 rounded-xl text-sm outline-none",
                  tc.formInput,
                )}
              />
            </div>

            <Field label="Body slot">
              <div className="flex flex-wrap gap-1.5">
                {SLOTS.map((s) => (
                  <TagPill
                    key={s}
                    label={s}
                    active={slot === s}
                    onClick={() => setSlot(s)}
                  />
                ))}
              </div>
            </Field>

            <Field label="Colors">
              <div className="flex flex-wrap gap-2">
                {COLOR_CHOICES.map((c) => {
                  const active = colors.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      aria-label={c.name}
                      onClick={() =>
                        setColors((prev) =>
                          active
                            ? prev.filter((x) => x !== c.name)
                            : prev.length < 6
                              ? [...prev, c.name]
                              : prev,
                        )
                      }
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all active:scale-90",
                        c.className,
                        active
                          ? "border-white scale-110"
                          : "border-white/20",
                      )}
                    />
                  );
                })}
              </div>
            </Field>

            <Field label="Season">
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <TagPill
                    key={s}
                    label={s}
                    active={season.includes(s)}
                    onClick={() =>
                      setSeason((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                  />
                ))}
              </div>
            </Field>

            <Field label="Formality">
              <div className="flex flex-wrap gap-1.5">
                {FORMALITIES.map((f) => (
                  <TagPill
                    key={f}
                    label={f}
                    active={formality === f}
                    onClick={() => setFormality(formality === f ? null : f)}
                  />
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Brand (optional)"
                className={cn("px-3 py-3 rounded-xl text-sm outline-none", tc.formInput)}
              />
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Size (optional)"
                className={cn("px-3 py-3 rounded-xl text-sm outline-none", tc.formInput)}
              />
            </div>

            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border opacity-50",
                tc.border,
              )}
            >
              <Sparkles className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/40">Auto-tag with AI — coming soon</span>
            </div>

            <button
              onClick={handleSave}
              disabled={!name.trim() || !slot || saving}
              className={cn(
                "w-full py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] neo-gradient text-white",
                (!name.trim() || !slot || saving) && "opacity-50",
              )}
            >
              {saving ? "Saving…" : "Save to wardrobe"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </OutfitSheet>
  );
}

function CaptureButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all active:scale-[0.98]",
        tc.border,
        tc.bgHover,
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tc.bgActive)}>
        {icon}
      </div>
      <div className="text-left">
        <p className={cn("text-sm font-semibold", tc.text)}>{title}</p>
        <p className="text-xs text-white/40">{subtitle}</p>
      </div>
    </button>
  );
}

function ApproveCard({
  label,
  url,
  selected,
  disabled,
  checker,
  onClick,
}: {
  label: string;
  url: string | null;
  selected: boolean;
  disabled?: boolean;
  checker?: boolean;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all active:scale-[0.98] flex items-center justify-center",
        selected ? tc.ringSelectionStrong : tc.border,
        selected ? "border-transparent" : "",
        disabled && "opacity-40",
      )}
      style={checker ? CHECKERBOARD : undefined}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-w-full max-h-full object-contain" />
      ) : (
        <span className="text-xs text-white/40">No cutout</span>
      )}
      <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide text-white/70 bg-black/50 rounded-md px-1.5 py-0.5">
        {label}
      </span>
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full neo-gradient flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      {children}
    </div>
  );
}

function TagPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all active:scale-95",
        active
          ? cn(tc.tabsTriggerActive, tc.text, "border-transparent")
          : cn(tc.pillBg, tc.border, "text-white/55"),
      )}
    >
      {label}
    </button>
  );
}
