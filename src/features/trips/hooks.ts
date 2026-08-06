"use client";

import { isReallyOnline, markOffline } from "@/lib/connectivityManager";
import { addToQueue } from "@/lib/offlineQueue";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { isOfflineError, safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import type {
  ActivateTripResult,
  CreateTripInput,
  CreateTripPackingItemInput,
  CreateTripPlaceInput,
  SavePackingCheckpointResult,
  Trip,
  TripDocument,
  TripPackingCategory,
  TripPackingCheckpoint,
  TripPackingItem,
  TripPlace,
  UpdateTripDocumentInput,
  UpdateTripInput,
  UpdateTripPackingItemInput,
  UpdateTripPlaceInput,
} from "@/types/trips";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flexibleRoutinesKeys } from "../items/useFlexibleRoutines";
import { itemsKeys } from "../items/useItems";
import { mealPlanKeys } from "../meal-planning/queryKeys";
import { tripDocumentsQueryOptions } from "./documentQueries";
import { tripKeys } from "./queryKeys";

// ── Fetch helpers ──────────────────────────────────────────────────────────

async function fetchTrips(templates = false): Promise<Trip[]> {
  const url = `/api/trips${templates ? "?templates=true" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

async function fetchTrip(id: string): Promise<Trip> {
  const res = await fetch(`/api/trips/${id}`);
  if (!res.ok) throw new Error("Failed to fetch trip");
  return res.json();
}

async function fetchTripPlaces(tripId: string): Promise<TripPlace[]> {
  const res = await fetch(`/api/trips/${tripId}/places`);
  if (!res.ok) throw new Error("Failed to fetch places");
  return res.json();
}

async function fetchTripPacking(tripId: string): Promise<TripPackingItem[]> {
  const res = await fetch(`/api/trips/${tripId}/packing`);
  if (!res.ok) throw new Error("Failed to fetch packing list");
  return res.json();
}

async function fetchTripPackingCategories(tripId: string): Promise<TripPackingCategory[]> {
  const res = await fetch(`/api/trips/${tripId}/packing/categories`);
  if (!res.ok) throw new Error("Failed to fetch packing categories");
  return res.json();
}

async function fetchTripPackingDeleted(tripId: string): Promise<TripPackingItem[]> {
  const res = await fetch(`/api/trips/${tripId}/packing/deleted`);
  if (!res.ok) throw new Error("Failed to fetch deleted packing items");
  return res.json();
}

async function fetchTripPackingCheckpoint(tripId: string): Promise<TripPackingCheckpoint> {
  const res = await fetch(`/api/trips/${tripId}/packing/checkpoint`);
  if (!res.ok) throw new Error("Failed to fetch packing checkpoint");
  return res.json();
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useTrips() {
  return useQuery({
    queryKey: tripKeys.list(),
    queryFn: () => fetchTrips(false),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTripTemplates() {
  return useQuery({
    queryKey: tripKeys.templates(),
    queryFn: () => fetchTrips(true),
    staleTime: 1000 * 60 * 10,
    select: (trips) => trips.filter((t) => t.is_template),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => fetchTrip(id),
    staleTime: 1000 * 60 * 2,
    enabled: !!id,
  });
}

export function useTripPlaces(tripId: string) {
  return useQuery({
    queryKey: tripKeys.places(tripId),
    queryFn: () => fetchTripPlaces(tripId),
    staleTime: 1000 * 60 * 5,
    enabled: !!tripId,
  });
}

export function useTripPacking(tripId: string) {
  return useQuery({
    queryKey: tripKeys.packing(tripId),
    queryFn: () => fetchTripPacking(tripId),
    staleTime: 1000 * 60 * 5,
    enabled: !!tripId,
  });
}

export function useTripPackingCategories(tripId: string) {
  return useQuery({
    queryKey: tripKeys.packingCategories(tripId),
    queryFn: () => fetchTripPackingCategories(tripId),
    staleTime: 1000 * 60 * 5,
    enabled: !!tripId,
  });
}

/** Soft-deleted packing items for this trip — powers the header's "Deleted
 * items" badge count and the recycle bin sheet's list. */
export function useTripPackingDeleted(tripId: string) {
  return useQuery({
    queryKey: tripKeys.packingDeleted(tripId),
    queryFn: () => fetchTripPackingDeleted(tripId),
    staleTime: 1000 * 30,
    enabled: !!tripId,
  });
}

export function useTripPackingCheckpoint(tripId: string) {
  return useQuery({
    queryKey: tripKeys.packingCheckpoint(tripId),
    queryFn: () => fetchTripPackingCheckpoint(tripId),
    staleTime: 1000 * 60,
    enabled: !!tripId,
  });
}

interface TripBundle {
  trip: Trip;
  is_owner: boolean;
  places: TripPlace[];
  packing: TripPackingItem[];
  packing_categories: TripPackingCategory[];
  documents: TripDocument[];
}

/**
 * Primes the detail/places/packing/documents caches from a single
 * get_trip_bundle() RPC call instead of the 3-4 separate round trips Trip
 * Detail would otherwise make as tabs are opened (Hard Rule #21). Call once
 * near the top of Trip Detail — the individual useTrip/useTripPlaces/
 * useTripPacking/useTripDocuments hooks used by each tab then read from the
 * warm cache instead of firing their own request.
 */
export function useTripBundle(tripId: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: [...tripKeys.all, "bundle", tripId],
    queryFn: async (): Promise<TripBundle> => {
      const res = await fetch(`/api/trips/${tripId}/bundle`);
      if (!res.ok) throw new Error("Failed to fetch trip bundle");
      const bundle = (await res.json()) as TripBundle;
      qc.setQueryData(tripKeys.detail(tripId), { ...bundle.trip, is_owner: bundle.is_owner });
      qc.setQueryData(tripKeys.places(tripId), bundle.places);
      qc.setQueryData(tripKeys.packing(tripId), bundle.packing);
      qc.setQueryData(tripKeys.packingCategories(tripId), bundle.packing_categories);
      qc.setQueryData(tripKeys.documents(tripId), bundle.documents);
      return bundle;
    },
    staleTime: 1000 * 60 * 2,
    enabled: !!tripId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const res = await safeFetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create trip");
      }
      return res.json() as Promise<Trip>;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
      const undo = () => {
        safeFetch(`/api/trips/${trip.id}`, { method: "DELETE" }).then(() =>
          qc.invalidateQueries({ queryKey: tripKeys.lists() }),
        );
      };
      toast.success("Trip created", {
        icon: ToastIcons.create,
        duration: 4000,
        action: { label: "Undo", onClick: undo },
      });
    },
    onError: () => toast.error("Failed to create trip", { icon: ToastIcons.error }),
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTripInput & { id: string }) => {
      const res = await safeFetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update trip");
      }
      return res.json() as Promise<Trip>;
    },
    onSuccess: (trip) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip);
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
    onError: () => toast.error("Failed to update trip", { icon: ToastIcons.error }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete trip");
      }
    },
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: tripKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
      toast.success("Trip deleted", { icon: ToastIcons.delete, duration: 4000 });
    },
    onError: () => toast.error("Failed to delete trip", { icon: ToastIcons.error }),
  });
}

export function useActivateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ trip: Trip; effects: ActivateTripResult }> => {
      const res = await safeFetch(`/api/trips/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs: 30_000,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to activate trip");
      }
      return res.json();
    },
    onSuccess: ({ trip, effects }) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip);
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
      // Invalidate all affected downstream caches
      invalidateAccountData(qc);
      qc.invalidateQueries({ queryKey: itemsKeys.all });
      qc.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
      qc.invalidateQueries({ queryKey: mealPlanKeys.all });

      const parts: string[] = [];
      if (effects.skipped_chores > 0) parts.push(`${effects.skipped_chores} chore${effects.skipped_chores > 1 ? "s" : ""} skipped`);
      if (effects.paused_recurring > 0) parts.push(`${effects.paused_recurring} recurring paused`);
      if (effects.skipped_events > 0) parts.push(`${effects.skipped_events} event${effects.skipped_events > 1 ? "s" : ""} cleared`);
      if (effects.skipped_meals > 0) parts.push(`${effects.skipped_meals} meal${effects.skipped_meals > 1 ? "s" : ""} skipped`);
      if (effects.reassigned_items > 0) parts.push(`${effects.reassigned_items} item${effects.reassigned_items > 1 ? "s" : ""} reassigned`);

      toast.success(
        parts.length > 0 ? `Trip activated — ${parts.join(", ")}` : "Trip activated",
        { icon: ToastIcons.success, duration: 5000 },
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to activate trip", { icon: ToastIcons.error }),
  });
}

export function useCompleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ trip: Trip }> => {
      const res = await safeFetch(`/api/trips/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs: 30_000,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to complete trip");
      }
      return res.json();
    },
    onSuccess: ({ trip }) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip);
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
      invalidateAccountData(qc);
      qc.invalidateQueries({ queryKey: itemsKeys.all });
      qc.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
      qc.invalidateQueries({ queryKey: mealPlanKeys.all });
      toast.success("Trip completed — schedule restored", { icon: ToastIcons.success, duration: 5000 });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to complete trip", { icon: ToastIcons.error }),
  });
}

export function useCloneTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, as_template }: { id: string; name: string; as_template?: boolean }) => {
      const res = await safeFetch(`/api/trips/${id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, as_template: as_template ?? false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to clone trip");
      }
      return res.json() as Promise<Trip>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
      qc.invalidateQueries({ queryKey: tripKeys.templates() });
      toast.success("Trip duplicated", { icon: ToastIcons.create, duration: 4000 });
    },
    onError: () => toast.error("Failed to duplicate trip", { icon: ToastIcons.error }),
  });
}

// ── Place mutations ────────────────────────────────────────────────────────

export function useCreateTripPlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripPlaceInput) => {
      const res = await safeFetch(`/api/trips/${tripId}/places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add place");
      }
      return res.json() as Promise<TripPlace>;
    },
    onSuccess: (place) => {
      qc.invalidateQueries({ queryKey: tripKeys.places(tripId) });
      const undo = () => {
        safeFetch(`/api/trips/${tripId}/places/${place.id}`, { method: "DELETE" }).then(() =>
          qc.invalidateQueries({ queryKey: tripKeys.places(tripId) }),
        );
      };
      toast.success("Place added", { icon: ToastIcons.create, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to add place", { icon: ToastIcons.error }),
  });
}

export function useUpdateTripPlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTripPlaceInput & { id: string }) => {
      const endpoint = `/api/trips/${tripId}/places/${id}`;

      if (!isReallyOnline()) {
        await addToQueue({
          feature: "trip",
          operation: "update",
          endpoint,
          method: "PATCH",
          body: input,
          metadata: { label: "Update trip place" },
        });
        return { id, ...input } as TripPlace;
      }

      try {
        const res = await safeFetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to update place");
        }
        return res.json() as Promise<TripPlace>;
      } catch (err) {
        if (isOfflineError(err)) {
          markOffline();
          await addToQueue({
            feature: "trip",
            operation: "update",
            endpoint,
            method: "PATCH",
            body: input,
            metadata: { label: "Update trip place" },
          });
          return { id, ...input } as TripPlace;
        }
        throw err;
      }
    },
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: tripKeys.places(tripId) });
      const previous = qc.getQueryData<TripPlace[]>(tripKeys.places(tripId));
      qc.setQueryData<TripPlace[]>(tripKeys.places(tripId), (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...input } : p)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tripKeys.places(tripId), ctx.previous);
      toast.error("Failed to update place", { icon: ToastIcons.error });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.places(tripId) }),
  });
}

export function useDeleteTripPlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placeId: string) => {
      const snapshot = qc.getQueryData<TripPlace[]>(tripKeys.places(tripId));
      const deleted = snapshot?.find((p) => p.id === placeId);
      const res = await safeFetch(`/api/trips/${tripId}/places/${placeId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete place");
      }
      return { placeId, deleted };
    },
    onSuccess: ({ deleted }) => {
      qc.invalidateQueries({ queryKey: tripKeys.places(tripId) });
      const undo = async () => {
        const place = deleted;
        if (!place) return;
        await safeFetch(`/api/trips/${tripId}/places`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(place),
        });
        qc.invalidateQueries({ queryKey: tripKeys.places(tripId) });
      };
      toast.success("Place removed", { icon: ToastIcons.delete, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to remove place", { icon: ToastIcons.error }),
  });
}

export function useReorderTripPlaces(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; position: number; scheduled_date?: string | null }>) => {
      const res = await safeFetch(`/api/trips/${tripId}/places/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to reorder places");
      }
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: tripKeys.places(tripId) });
      const previous = qc.getQueryData<TripPlace[]>(tripKeys.places(tripId));
      const byId = new Map(updates.map((u) => [u.id, u]));
      qc.setQueryData<TripPlace[]>(tripKeys.places(tripId), (old) =>
        old?.map((p) => {
          const u = byId.get(p.id);
          if (!u) return p;
          return { ...p, position: u.position, scheduled_date: u.scheduled_date !== undefined ? u.scheduled_date : p.scheduled_date };
        }) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tripKeys.places(tripId), ctx.previous);
      toast.error("Failed to reorder places", { icon: ToastIcons.error });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.places(tripId) }),
  });
}

// ── Packing mutations ─────────────────────────────────────────────────────

export function useCreatePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripPackingItemInput) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add packing item");
      }
      return res.json() as Promise<TripPackingItem>;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: tripKeys.packing(tripId) });
      const previous = qc.getQueryData<TripPackingItem[]>(tripKeys.packing(tripId));
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: TripPackingItem = {
        id: tempId,
        user_id: "",
        trip_id: tripId,
        name: input.name,
        category_id: input.category_id ?? null,
        packing_category: input.category_id
          ? qc.getQueryData<TripPackingCategory[]>(tripKeys.packingCategories(tripId))?.find((category) => category.id === input.category_id) ?? null
          : null,
        quantity: input.quantity ?? 1,
        packed_quantity: 0,
        is_packed: false,
        position: input.position ?? 0,
        inventory_item_id: input.inventory_item_id ?? null,
        catalogue_item_id: input.catalogue_item_id ?? null,
        assigned_to: input.assigned_to ?? null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<TripPackingItem[]>(tripKeys.packing(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous, tempId };
    },
    onSuccess: (item, _vars, ctx) => {
      qc.setQueryData<TripPackingItem[]>(tripKeys.packing(tripId), (old) =>
        old?.map((i) => i.id === ctx?.tempId ? item : i) ?? [],
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tripKeys.packing(tripId), ctx.previous);
      toast.error("Failed to add item", { icon: ToastIcons.error });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) }),
  });
}

export function useUpdatePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTripPackingItemInput & { id: string }) => {
      const endpoint = `/api/trips/${tripId}/packing/${id}`;

      if (!isReallyOnline()) {
        await addToQueue({
          feature: "trip",
          operation: "update",
          endpoint,
          method: "PATCH",
          body: input,
          metadata: { label: "Update packing item" },
        });
        return { id, ...input } as TripPackingItem;
      }

      try {
        const res = await safeFetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to update item");
        }
        return res.json() as Promise<TripPackingItem>;
      } catch (err) {
        if (isOfflineError(err)) {
          markOffline();
          await addToQueue({
            feature: "trip",
            operation: "update",
            endpoint,
            method: "PATCH",
            body: input,
            metadata: { label: "Update packing item" },
          });
          return { id, ...input } as TripPackingItem;
        }
        throw err;
      }
    },
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: tripKeys.packing(tripId) });
      const previous = qc.getQueryData<TripPackingItem[]>(tripKeys.packing(tripId));
      qc.setQueryData<TripPackingItem[]>(tripKeys.packing(tripId), (old) =>
        old?.map((item) => {
          if (item.id !== id) return item;
          const merged = { ...item, ...input };
          // Derive is_packed from packed_quantity when it's being updated
          if (input.packed_quantity !== undefined) {
            merged.is_packed = merged.packed_quantity >= merged.quantity;
          }
          return merged;
        }) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tripKeys.packing(tripId), ctx.previous);
      toast.error("Failed to update item", { icon: ToastIcons.error });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) }),
  });
}

export function useCreatePackingCategory(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add category");
      }
      return res.json() as Promise<TripPackingCategory>;
    },
    onSuccess: (category) => {
      qc.invalidateQueries({ queryKey: tripKeys.packingCategories(tripId) });
      const undo = () => {
        safeFetch(`/api/trips/${tripId}/packing/categories/${category.id}`, { method: "DELETE" }).then(() => {
          qc.invalidateQueries({ queryKey: tripKeys.packingCategories(tripId) });
          qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
        });
      };
      toast.success("Category added", {
        icon: ToastIcons.create,
        duration: 4000,
        action: { label: "Undo", onClick: undo },
      });
    },
    onError: () => toast.error("Failed to add category", { icon: ToastIcons.error }),
  });
}

export function useUpdatePackingCategory(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update category");
      }
      return res.json() as Promise<TripPackingCategory>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.packingCategories(tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
    },
    onError: () => toast.error("Failed to update category", { icon: ToastIcons.error }),
  });
}

export function useDeletePackingCategory(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/categories/${categoryId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove category");
      }
    },
    onSuccess: () => {
      // Deleting a category unsets linked item references and cannot be safely undone.
      qc.invalidateQueries({ queryKey: tripKeys.packingCategories(tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
    },
    onError: () => toast.error("Failed to remove category", { icon: ToastIcons.error }),
  });
}

export function useBulkCreatePackingItems(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: CreateTripPackingItemInput[]) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add items");
      }
      return res.json() as Promise<TripPackingItem[]>;
    },
    onSuccess: (items) => {
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      const undo = () => Promise.all(
        items.map((item) => safeFetch(`/api/trips/${tripId}/packing/${item.id}`, { method: "DELETE" })),
      ).then(() => qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) }));
      toast.success(`${items.length} item${items.length === 1 ? "" : "s"} added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: { label: "Undo", onClick: undo },
      });
    },
    onError: () => toast.error("Failed to add items", { icon: ToastIcons.error }),
  });
}

export function useReorderPackingItems(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; position: number }>) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to reorder items");
      }
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: tripKeys.packing(tripId) });
      const previous = qc.getQueryData<TripPackingItem[]>(tripKeys.packing(tripId));
      const positionById = new Map(updates.map((u) => [u.id, u.position]));
      qc.setQueryData<TripPackingItem[]>(tripKeys.packing(tripId), (old) =>
        old
          ?.map((item) => (positionById.has(item.id) ? { ...item, position: positionById.get(item.id)! } : item))
          .sort((a, b) => a.position - b.position) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tripKeys.packing(tripId), ctx.previous);
      toast.error("Failed to reorder items", { icon: ToastIcons.error });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) }),
  });
}

export function useDeletePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/${itemId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete item");
      }
      return { itemId };
    },
    onSuccess: ({ itemId }) => {
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.packingDeleted(tripId) });
      // Soft delete (server sets deleted_at) — undo just nulls it back out via
      // the restore route, which preserves quantity/packed state/position
      // exactly instead of re-inserting a fresh row.
      const undo = async () => {
        await safeFetch(`/api/trips/${tripId}/packing/${itemId}/restore`, { method: "POST" });
        qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
        qc.invalidateQueries({ queryKey: tripKeys.packingDeleted(tripId) });
      };
      toast.success("Item removed", { icon: ToastIcons.delete, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to remove item", { icon: ToastIcons.error }),
  });
}

export function useRestorePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/${itemId}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to restore item");
      }
      return res.json() as Promise<TripPackingItem>;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      qc.invalidateQueries({ queryKey: tripKeys.packingDeleted(tripId) });
      const undo = async () => {
        await safeFetch(`/api/trips/${tripId}/packing/${item.id}`, { method: "DELETE" });
        qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
        qc.invalidateQueries({ queryKey: tripKeys.packingDeleted(tripId) });
      };
      toast.success("Item restored", { icon: ToastIcons.success, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to restore item", { icon: ToastIcons.error }),
  });
}

export function useSavePackingCheckpoint(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/checkpoint`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save checkpoint");
      }
      return res.json() as Promise<SavePackingCheckpointResult>;
    },
    onSuccess: ({ created_at, previous }) => {
      qc.setQueryData<TripPackingCheckpoint>(tripKeys.packingCheckpoint(tripId), { created_at });
      // Undo re-upserts the exact prior snapshot (verbatim, including its own
      // created_at) if one existed, or deletes the checkpoint row entirely if
      // this was the first-ever save — a client-side cache tweak alone would
      // leave the unwanted snapshot as the source of truth for a later revert.
      const undo = async () => {
        if (previous) {
          await safeFetch(`/api/trips/${tripId}/packing/checkpoint`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restore: previous }),
          });
          qc.setQueryData<TripPackingCheckpoint>(tripKeys.packingCheckpoint(tripId), { created_at: previous.created_at });
        } else {
          await safeFetch(`/api/trips/${tripId}/packing/checkpoint`, { method: "DELETE" });
          qc.setQueryData<TripPackingCheckpoint>(tripKeys.packingCheckpoint(tripId), { created_at: null });
        }
      };
      toast.success("Checkpoint saved", { icon: ToastIcons.success, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to save checkpoint", { icon: ToastIcons.error }),
  });
}

export function useRevertPackingCheckpoint(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await safeFetch(`/api/trips/${tripId}/packing/checkpoint/revert`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to revert to checkpoint");
      }
      return res.json() as Promise<{ applied: number }>;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: tripKeys.packing(tripId) });
      const previous = qc.getQueryData<TripPackingItem[]>(tripKeys.packing(tripId));
      return { previous };
    },
    onSuccess: (_result, _vars, ctx) => {
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      const undo = async () => {
        if (!ctx?.previous) return;
        await Promise.all(
          ctx.previous.map((item) =>
            safeFetch(`/api/trips/${tripId}/packing/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ packed_quantity: item.packed_quantity, is_packed: item.is_packed }),
            }),
          ),
        );
        qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      };
      toast.success("Reverted to last checkpoint", { icon: ToastIcons.success, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to revert to checkpoint", { icon: ToastIcons.error }),
  });
}

// ── Document mutations ────────────────────────────────────────────────────

export function useTripDocuments(tripId: string) {
  return useQuery(tripDocumentsQueryOptions(tripId));
}

export function useTripDocumentUrls(tripId: string, rawPaths: Array<string | null | undefined>) {
  const paths = [...new Set(rawPaths.filter((p): p is string => !!p))].sort().slice(0, 100);
  const query = useQuery({
    queryKey: tripKeys.documentUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const res = await safeFetch(`/api/trips/${tripId}/documents/signed-urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
        timeoutMs: 15_000,
      });
      if (!res.ok) throw new Error("Failed to sign document URLs");
      const data = await res.json();
      return data.urls ?? {};
    },
  });
  return { ...query, urls: query.data ?? {}, getUrl: (path: string | null | undefined) => (path ? (query.data?.[path] ?? null) : null) };
}

export interface CreateTripDocumentUpload {
  file: File;
  title: string;
  doc_type: TripDocument["doc_type"];
  expires_on?: string | null;
  notes?: string | null;
}

export function useCreateTripDocument(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripDocumentUpload) => {
      const form = new FormData();
      form.set("file", input.file);
      form.set("title", input.title);
      form.set("doc_type", input.doc_type);
      if (input.expires_on) form.set("expires_on", input.expires_on);
      if (input.notes) form.set("notes", input.notes);
      const res = await safeFetch(`/api/trips/${tripId}/documents`, {
        method: "POST",
        body: form,
        timeoutMs: 30_000,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to upload document");
      }
      return res.json() as Promise<TripDocument>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.documents(tripId) });
      toast.success("Document added", { icon: ToastIcons.create, duration: 4000 });
    },
    onError: () => toast.error("Failed to upload document", { icon: ToastIcons.error }),
  });
}

export function useUpdateTripDocument(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTripDocumentInput & { id: string }) => {
      const res = await safeFetch(`/api/trips/${tripId}/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update document");
      }
      return res.json() as Promise<TripDocument>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.documents(tripId) }),
    onError: () => toast.error("Failed to update document", { icon: ToastIcons.error }),
  });
}

export function useDeleteTripDocument(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await safeFetch(`/api/trips/${tripId}/documents/${docId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete document");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.documents(tripId) });
      toast.success("Document removed", { icon: ToastIcons.delete, duration: 4000 });
    },
    onError: () => toast.error("Failed to remove document", { icon: ToastIcons.error }),
  });
}
