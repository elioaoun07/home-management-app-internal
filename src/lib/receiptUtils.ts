// Canvas-based receipt image compression with contrast boost for text readability.
// Targets ~80 KB JPEG. Attempts quality 0.75 → 0.30 until size fits.
export async function compressReceiptImage(
  file: File,
  maxSizeKB = 80,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX_DIM = 1400; // large enough to keep receipt text readable
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      // Mild contrast + brightness lift to sharpen printed text on receipts
      ctx.filter = "contrast(1.25) brightness(1.05)";
      ctx.drawImage(img, 0, 0, width, height);

      const attempt = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob returned null"));
              return;
            }
            if (blob.size <= maxSizeKB * 1024 || quality <= 0.25) {
              resolve(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
            } else {
              attempt(Math.max(0.25, quality - 0.1));
            }
          },
          "image/jpeg",
          quality,
        );
      };

      attempt(0.75);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}

/** Returns a human-readable file size string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
