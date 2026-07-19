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
 *
 * Requires the page to be cross-origin isolated (COOP+COEP response headers,
 * see next.config.ts): the only WASM build this library ships unconditionally
 * allocates a `WebAssembly.Memory({shared: true})`, which needs
 * SharedArrayBuffer — there is no non-shared fallback build to opt into.
 */
export async function removeGarmentBackground(
  source: File,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<File> {
  let blob: Blob;
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    blob = await removeBackground(source, {
      output: { format: "image/webp", quality: 0.8 },
      progress: (key, current, total) => onProgress?.({ key, current, total }),
    });
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
