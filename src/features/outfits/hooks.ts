// src/features/outfits/hooks.ts
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { outfitKeys } from "./queryKeys";
import type {
  CreateOutfitDTO,
  CreateWardrobeItemDTO,
  Outfit,
  SaveWardrobeProfileDTO,
  UpdateOutfitDTO,
  UpdateWardrobeItemDTO,
  WardrobeItem,
  WardrobeProfile,
} from "./types";

async function requestJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
): Promise<T> {
  const res = await safeFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useWardrobeItems(includeArchived = false) {
  return useQuery({
    queryKey: outfitKeys.itemList({ includeArchived }),
    queryFn: async (): Promise<WardrobeItem[]> => {
      if (!isReallyOnline()) throw new Error("Offline");
      const res = await fetch(
        `/api/outfits/items${includeArchived ? "?includeArchived=true" : ""}`,
      );
      if (!res.ok) throw new Error("Failed to fetch wardrobe");
      const data = await res.json();
      return data.items ?? [];
    },
    staleTime: CACHE_TIMES.RECURRING,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}

export function useOutfits(includeArchived = false) {
  return useQuery({
    queryKey: [...outfitKeys.outfits(), { includeArchived }],
    queryFn: async (): Promise<Outfit[]> => {
      if (!isReallyOnline()) throw new Error("Offline");
      const res = await fetch(
        `/api/outfits${includeArchived ? "?includeArchived=true" : ""}`,
      );
      if (!res.ok) throw new Error("Failed to fetch outfits");
      const data = await res.json();
      return data.outfits ?? [];
    },
    staleTime: CACHE_TIMES.RECURRING,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}

export function useWardrobeProfile() {
  return useQuery({
    queryKey: outfitKeys.profile(),
    queryFn: async (): Promise<WardrobeProfile | null> => {
      if (!isReallyOnline()) throw new Error("Offline");
      const res = await fetch("/api/outfits/profile");
      if (!res.ok) throw new Error("Failed to fetch sizing profile");
      const data = await res.json();
      return data.profile ?? null;
    },
    staleTime: CACHE_TIMES.PREFERENCES,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}

function useInvalidateOutfits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: outfitKeys.all });
}

// ── Garments ─────────────────────────────────────────────────────────────────

export function useCreateGarment() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: (payload: CreateWardrobeItemDTO) =>
      requestJson<{ item: WardrobeItem }>("/api/outfits/items", "POST", payload),
    onSuccess: ({ item }) => {
      toast.success(`"${item.name}" added to wardrobe`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/outfits/items/${item.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add garment", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

/**
 * Multipart image upload for a garment. No toast of its own — it runs inside
 * the AddGarmentSheet save flow, whose create toast is the user-facing signal.
 * Long call (2 files over mobile upload) → explicit timeoutMs (Hard Rule 6).
 */
export function useUploadGarmentImages() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: async ({
      itemId,
      original,
      cutout,
    }: {
      itemId: string;
      original?: File;
      cutout?: File;
    }) => {
      const form = new FormData();
      if (original) form.append("original", original);
      if (cutout) form.append("cutout", cutout);
      const res = await safeFetch(`/api/outfits/items/${itemId}/images`, {
        method: "POST",
        body: form,
        timeoutMs: 60_000,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Image upload failed");
      }
      return res.json() as Promise<{ image_path?: string; cutout_path?: string }>;
    },
    onSettled: invalidate,
  });
}

export function useUpdateGarment() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateWardrobeItemDTO;
      /** Pass the pre-edit values to enable a real Undo. */
      previous?: UpdateWardrobeItemDTO;
    }) => requestJson<{ item: WardrobeItem }>(`/api/outfits/items/${id}`, "PATCH", data),
    onSuccess: (_res, { id, previous }) => {
      toast.success("Garment updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/outfits/items/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update garment", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

export function useArchiveGarment() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean; name?: string }) =>
      requestJson<{ item: WardrobeItem }>(`/api/outfits/items/${id}`, "PATCH", { archived }),
    // Optimistic removal so the grid responds instantly.
    onMutate: async ({ id, archived }) => {
      await queryClient.cancelQueries({ queryKey: outfitKeys.items() });
      const previous = queryClient.getQueriesData<WardrobeItem[]>({
        queryKey: outfitKeys.items(),
      });
      queryClient.setQueriesData<WardrobeItem[]>(
        { queryKey: outfitKeys.itemList({ includeArchived: false }) },
        (old) => (archived ? old?.filter((i) => i.id !== id) : old),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(err instanceof Error ? err.message : "Failed to archive garment", {
        icon: ToastIcons.error,
      });
    },
    onSuccess: ({ item }, { archived }) => {
      toast.success(archived ? `"${item.name}" archived` : `"${item.name}" restored`, {
        icon: archived ? ToastIcons.delete : ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/outfits/items/${item.id}`, "PATCH", {
              archived: !archived,
            });
            invalidate();
          },
        },
      });
    },
    onSettled: invalidate,
  });
}

/**
 * Hard delete. Undo recreates the garment row from the cached fields — the
 * uploaded photos are gone for good (storage files are removed server-side).
 * The detail sheet says so before deleting; archive is the soft path.
 */
export function useDeleteGarment() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: async (item: WardrobeItem) => {
      await requestJson(`/api/outfits/items/${item.id}`, "DELETE");
      return item;
    },
    onSuccess: (item) => {
      toast.success(`"${item.name}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson("/api/outfits/items", "POST", {
              name: item.name,
              slot: item.slot,
              subcategory: item.subcategory,
              colors: item.colors,
              brand: item.brand,
              size: item.size,
              season: item.season,
              formality: item.formality,
              style_tags: item.style_tags,
              fit_note: item.fit_note,
              ai_tagged: item.ai_tagged,
              ai_confidence: item.ai_confidence,
            });
            invalidate();
            toast.info("Garment restored — photos need re-uploading", {
              icon: ToastIcons.update,
              duration: 4000,
              action: { label: "OK", onClick: () => {} },
            });
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete garment", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

// ── Outfits ──────────────────────────────────────────────────────────────────

export function useSaveOutfit() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: (payload: CreateOutfitDTO) =>
      requestJson<{ outfit: Outfit }>("/api/outfits", "POST", payload),
    onSuccess: ({ outfit }) => {
      toast.success(`Outfit "${outfit.name}" saved`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/outfits/${outfit.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save outfit", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

export function useUpdateOutfit() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateOutfitDTO;
      /** Pass the pre-edit values (incl. items) to enable a real Undo. */
      previous?: UpdateOutfitDTO;
    }) => requestJson<{ outfit: Outfit }>(`/api/outfits/${id}`, "PATCH", data),
    onSuccess: (_res, { id, previous }) => {
      toast.success("Outfit updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/outfits/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update outfit", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

export function useDeleteOutfit() {
  const invalidate = useInvalidateOutfits();
  return useMutation({
    mutationFn: async (outfit: Outfit) => {
      await requestJson(`/api/outfits/${outfit.id}`, "DELETE");
      return outfit;
    },
    onSuccess: (outfit) => {
      toast.success(`Outfit "${outfit.name}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson("/api/outfits", "POST", {
              name: outfit.name,
              occasion_hint: outfit.occasion_hint,
              notes: outfit.notes,
              items: outfit.outfit_items.map((oi) => ({
                slot: oi.slot,
                item_id: oi.item_id,
              })),
            });
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete outfit", {
        icon: ToastIcons.error,
      }),
    onSettled: invalidate,
  });
}

// ── Sizing profile ───────────────────────────────────────────────────────────

export function useSaveWardrobeProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
    }: {
      data: SaveWardrobeProfileDTO;
      previous?: SaveWardrobeProfileDTO;
    }) => requestJson<{ profile: WardrobeProfile }>("/api/outfits/profile", "PUT", data),
    onSuccess: (_res, { previous }) => {
      toast.success("Sizing profile saved", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson("/api/outfits/profile", "PUT", previous);
            }
            queryClient.invalidateQueries({ queryKey: outfitKeys.profile() });
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save profile", {
        icon: ToastIcons.error,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: outfitKeys.profile() }),
  });
}
