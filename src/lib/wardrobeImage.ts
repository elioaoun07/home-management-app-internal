// src/lib/wardrobeImage.ts
// Canvas compression for wardrobe garment images.
//
// Deliberately separate from compressReceiptImage (src/lib/receiptUtils.ts):
// that helper is hard-coded to JPEG and flattens the alpha channel, which
// destroys background-removed cutouts. This one outputs WebP with alpha
// preserved and applies no contrast filter. Do not merge the two.

export interface WardrobeCompressOptions {
  /** Longest edge in px after resize. Originals: 1400. Cutouts: 800. */
  maxDim?: number;
  /** Target upper bound; quality steps down 0.85 → 0.40 until it fits. */
  maxSizeKB?: number;
  fileName?: string;
}

export async function compressWardrobeImage(
  source: File | Blob,
  { maxDim = 1400, maxSizeKB = 150, fileName = "garment.webp" }: WardrobeCompressOptions = {},
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      // Transparent canvas + no filter: alpha from the source survives into WebP.
      ctx.drawImage(img, 0, 0, width, height);

      const attempt = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob returned null"));
              return;
            }
            if (blob.size <= maxSizeKB * 1024 || quality <= 0.4) {
              resolve(new File([blob], fileName, { type: "image/webp" }));
            } else {
              attempt(Math.max(0.4, quality - 0.1));
            }
          },
          "image/webp",
          quality,
        );
      };

      attempt(0.85);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}
