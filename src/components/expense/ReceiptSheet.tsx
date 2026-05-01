"use client";

import {
  BillIcon,
  CheckIcon,
  ScanIcon,
  Trash2Icon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { compressReceiptImage, formatFileSize } from "@/lib/receiptUtils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "options" | "preview" | "uploading" | "viewing";

interface Props {
  open: boolean;
  onClose: () => void;
  /** If set, receipt will be uploaded immediately on capture (existing transaction). */
  transactionId?: string;
  /** Current storage path if a receipt already exists. */
  currentReceiptPath?: string | null;
  /** Called when a file is captured (new transaction — caller handles upload). */
  onCapture?: (file: File) => void;
  /** Called after upload succeeds (existing transaction flow). */
  onUploaded?: (path: string) => void;
  /** Called after receipt is removed. */
  onRemoved?: () => void;
}

export default function ReceiptSheet({
  open,
  onClose,
  transactionId,
  currentReceiptPath,
  onCapture,
  onUploaded,
  onRemoved,
}: Props) {
  const tc = useThemeClasses();
  const [mode, setMode] = useState<Mode>(
    currentReceiptPath ? "viewing" : "options",
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressedSize, setCompressedSize] = useState<string>("");
  const [isClosing, setIsClosing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Generate signed URL for existing receipt
  useEffect(() => {
    if (!currentReceiptPath) { setSignedUrl(null); return; }
    supabaseBrowser()
      .storage.from("receipts")
      .createSignedUrl(currentReceiptPath, 3600)
      .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
  }, [currentReceiptPath]);

  // Reset internal state when sheet opens
  useEffect(() => {
    if (open) {
      setMode(currentReceiptPath ? "viewing" : "options");
      setPreview(null);
      setCompressedFile(null);
      setCompressedSize("");
      setUploadError(null);
      setIsClosing(false);
    }
  }, [open, currentReceiptPath]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  const processFile = async (file: File) => {
    try {
      const compressed = await compressReceiptImage(file);
      const objectUrl = URL.createObjectURL(compressed);
      setPreview(objectUrl);
      setCompressedFile(compressed);
      setCompressedSize(formatFileSize(compressed.size));
      setMode("preview");
    } catch {
      setUploadError("Could not process image. Try again.");
      setMode("options");
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await processFile(file);
  };

  const handleConfirm = async () => {
    if (!compressedFile) return;

    if (!transactionId) {
      // New-transaction flow — just hand the file to the parent
      onCapture?.(compressedFile);
      handleClose();
      return;
    }

    // Existing transaction — upload immediately
    setMode("uploading");
    setUploadError(null);
    const fd = new FormData();
    fd.append("image", compressedFile);

    try {
      const res = await fetch(`/api/transactions/${transactionId}/receipt`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      onUploaded?.(json.receipt_url);
      handleClose();
    } catch {
      setUploadError("Upload failed. Please try again.");
      setMode("preview");
    }
  };

  const handleRemove = async () => {
    if (!transactionId) { onRemoved?.(); handleClose(); return; }
    try {
      await fetch(`/api/transactions/${transactionId}/receipt`, {
        method: "DELETE",
      });
      onRemoved?.();
      handleClose();
    } catch {
      setUploadError("Remove failed. Try again.");
    }
  };

  if (!open && !isClosing) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.22s ease-in forwards"
          : "modalBackdropFadeIn 0.18s ease-out forwards",
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet Panel */}
      <div
        className={cn(
          "relative w-full max-w-md rounded-t-3xl shadow-2xl neo-glow flex flex-col",
          tc.bgPage,
        )}
        style={{
          animation: isClosing
            ? "modalSlideDown 0.22s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BillIcon className={cn("w-5 h-5", tc.text, tc.glow)} />
            <h3 className="text-base font-semibold text-white">
              {mode === "viewing" ? "Receipt" : mode === "preview" ? "Confirm Receipt" : "Attach Receipt"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className={cn("p-2 rounded-lg transition-colors", tc.hoverBgSubtle)}
          >
            <XIcon className={cn("w-5 h-5", tc.headerText)} />
          </button>
        </div>

        {/* Hidden file inputs */}
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

        {/* Content */}
        <div className="px-4 pb-6 space-y-3">
          {uploadError && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-3 py-2">
              {uploadError}
            </p>
          )}

          {/* VIEWING mode — existing receipt */}
          {mode === "viewing" && signedUrl && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt="Receipt"
                  className="w-full object-contain max-h-72"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setMode("options"); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
                    tc.border, tc.bgHover, tc.text,
                  )}
                >
                  <ScanIcon className="w-4 h-4" />
                  Replace
                </button>
                <button
                  onClick={handleRemove}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all active:scale-95"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* VIEWING mode — signed URL still loading */}
          {mode === "viewing" && !signedUrl && (
            <div className="flex items-center justify-center py-10">
              <div className={cn("w-6 h-6 rounded-full border-2 animate-spin", tc.border, "border-t-transparent")} />
            </div>
          )}

          {/* OPTIONS mode */}
          {mode === "options" && (
            <div className="space-y-2">
              {/* Camera tip */}
              <div className="text-xs text-white/40 text-center pb-1">
                Hold 25–35 cm away · ensure even lighting for sharp text
              </div>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all active:scale-[0.98]",
                  tc.border, tc.bgHover,
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tc.bgActive)}>
                  <CameraOutlineIcon className={cn("w-5 h-5", tc.text)} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Take Photo</p>
                  <p className="text-xs text-white/40">Use rear camera for best focus</p>
                </div>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all active:scale-[0.98]",
                  tc.border, tc.bgHover,
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tc.bgActive)}>
                  <GalleryOutlineIcon className={cn("w-5 h-5", tc.text)} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Choose from Gallery</p>
                  <p className="text-xs text-white/40">Select an existing photo</p>
                </div>
              </button>
            </div>
          )}

          {/* PREVIEW mode */}
          {mode === "preview" && preview && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Receipt preview" className="w-full object-contain max-h-72" />
                <div className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-white/70">
                  {compressedSize}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setMode("options"); setPreview(null); setCompressedFile(null); }}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-medium transition-all active:scale-95",
                    tc.border, tc.bgHover, tc.text,
                  )}
                >
                  Retake
                </button>
                <button
                  onClick={handleConfirm}
                  className={cn("flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 neo-gradient text-white")}
                >
                  <span className="flex items-center justify-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    {transactionId ? "Upload" : "Attach"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* UPLOADING mode */}
          {mode === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className={cn("w-8 h-8 rounded-full border-2 animate-spin", tc.border, "border-t-transparent")} />
              <p className="text-sm text-white/60">Uploading receipt…</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Inline minimal SVG icons to avoid adding to FuturisticIcons (camera + gallery)
function CameraOutlineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function GalleryOutlineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
