import { safeFetch } from "@/lib/safeFetch";

/** Signs at click time: a cached URL goes stale (1h JWT) in a long-lived PWA. */
export async function openTripFile(tripId: string, storagePath: string): Promise<void> {
  const win = window.open("", "_blank"); // opened synchronously so mobile pop-up blockers allow it
  try {
    const res = await safeFetch(`/api/trips/${tripId}/documents/signed-urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [storagePath] }),
      timeoutMs: 15_000,
    });
    const data = await res.json();
    const url = data.urls?.[storagePath];
    if (!res.ok || !url) throw new Error("sign failed");
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch {
    win?.close();
  }
}

export async function uploadPlaceAttachment(tripId: string, placeId: string, file: File): Promise<void> {
  const form = new FormData();
  form.set("file", file);
  const res = await safeFetch(`/api/trips/${tripId}/places/${placeId}/attachment`, {
    method: "POST",
    body: form,
    timeoutMs: 30_000,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to upload attachment");
  }
}

export async function removePlaceAttachment(tripId: string, placeId: string, path: string): Promise<void> {
  const res = await safeFetch(`/api/trips/${tripId}/places/${placeId}/attachment?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Failed to remove attachment");
}

/** Re-encodes an image as WebP (max 1400px, no filters so QR codes stay scannable). PDFs and failures pass through. */
export async function toWebp(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], "attachment.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
