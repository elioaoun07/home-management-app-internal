// src/lib/backgroundRemoval.ts
// On-device garment background removal via @imgly/background-removal.
//
// The ONNX/WASM runtime plus a ~40-80 MB model download on first use — the
// library must ONLY ever be loaded through the dynamic import below, never at
// module top level, or the whole bundle lands in the PWA shell. The model is
// browser-cached after the first run.
//
// Failure here is expected and non-fatal: callers catch
// BackgroundRemovalError and fall back to "Keep original".

import { compressWardrobeImage } from "@/lib/wardrobeImage";

export interface BgRemovalProgress {
  /** Asset being fetched/computed (e.g. "fetch:/models/isnet_fp16"). */
  key: string;
  current: number;
  total: number;
}

export class BackgroundRemovalError extends Error {
  constructor(message = "Background removal failed") {
    super(message);
    this.name = "BackgroundRemovalError";
  }
}

/**
 * Returns the cutout as a compressed WebP-with-alpha File (max 800 px).
 * The input should already be the compressed original from
 * compressWardrobeImage — feeding the raw camera file wastes decode time.
 */
/**
 * onnxruntime-web (used internally by @imgly/background-removal) always sets
 * `numThreads = navigator.hardwareConcurrency`, forcing the multi-threaded WASM
 * build — which needs SharedArrayBuffer, only available on cross-origin-isolated
 * pages (COOP+COEP headers). This app doesn't set those site-wide (COOP:
 * same-origin risks breaking the Google Calendar OAuth popup's window.opener),
 * so instead we shadow hardwareConcurrency to 1 for the duration of this call —
 * forces ORT onto the single-threaded path, sidestepping the isolation
 * requirement entirely. Slower per-cutout, but has zero blast radius elsewhere.
 */
async function withSingleThreadedWasm<T>(fn: () => Promise<T>): Promise<T> {
  const original = navigator.hardwareConcurrency;
  Object.defineProperty(navigator, "hardwareConcurrency", {
    value: 1,
    configurable: true,
  });
  try {
    return await fn();
  } finally {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      value: original,
      configurable: true,
    });
  }
}

export async function removeGarmentBackground(
  source: File,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<File> {
  let blob: Blob;
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    blob = await withSingleThreadedWasm(() =>
      removeBackground(source, {
        output: { format: "image/webp", quality: 0.8 },
        progress: (key, current, total) => onProgress?.({ key, current, total }),
      }),
    );
  } catch (err) {
    throw new BackgroundRemovalError(
      err instanceof Error ? err.message : "Background removal failed",
    );
  }

  try {
    return await compressWardrobeImage(blob, {
      maxDim: 800,
      maxSizeKB: 120,
      fileName: "cutout.webp",
    });
  } catch {
    throw new BackgroundRemovalError("Cutout post-compression failed");
  }
}
