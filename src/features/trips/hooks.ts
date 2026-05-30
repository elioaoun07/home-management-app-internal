"use client";

import { invalidateAccountData } from "@/lib/queryInvalidation";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import type {
  ActivateTripResult,
  CreateTripInput,
  CreateTripPackingItemInput,
  CreateTripPlaceInput,
  Trip,
  TripPackingItem,
  TripPlace,
  UpdateTripInput,
  UpdateTripPackingItemInput,
  UpdateTripPlaceInput,
} from "@/types/trips";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flexibleRoutinesKeys } from "../items/useFlexibleRoutines";
import { itemsKeys } from "../items/useItems";
import { mealPlanKeys } from "../meal-planning/queryKeys";
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
      const res = await safeFetch(`/api/trips/${tripId}/places/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update place");
      }
      return res.json() as Promise<TripPlace>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.places(tripId) }),
    onError: () => toast.error("Failed to update place", { icon: ToastIcons.error }),
  });
}

export function useDeleteTripPlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placeId: string) => {
      const snapshot = qc.getQueryData<TripPlace[]>(tripKeys.places(tripId));
      const res = await safeFetch(`/api/trips/${tripId}/places/${placeId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete place");
      }
      return { placeId, snapshot };
    },
    onSuccess: ({ snapshot }) => {
      qc.invalidateQueries({ queryKey: tripKeys.places(tripId) });
      const undo = async () => {
        const place = snapshot?.find(() => true);
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
        category: input.category ?? null,
        quantity: input.quantity ?? 1,
        packed_quantity: 0,
        is_packed: false,
        position: input.position ?? 0,
        inventory_item_id: input.inventory_item_id ?? null,
        catalogue_item_id: input.catalogue_item_id ?? null,
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
      const res = await safeFetch(`/api/trips/${tripId}/packing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update item");
      }
      return res.json() as Promise<TripPackingItem>;
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

export function useDeletePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const snapshot = qc.getQueryData<TripPackingItem[]>(tripKeys.packing(tripId));
      const deleted = snapshot?.find((i) => i.id === itemId);
      const res = await safeFetch(`/api/trips/${tripId}/packing/${itemId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete item");
      }
      return { itemId, deleted };
    },
    onSuccess: ({ deleted }) => {
      qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      const undo = async () => {
        if (!deleted) return;
        await safeFetch(`/api/trips/${tripId}/packing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: deleted.name, category: deleted.category, quantity: deleted.quantity }),
        });
        qc.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      };
      toast.success("Item removed", { icon: ToastIcons.delete, duration: 4000, action: { label: "Undo", onClick: undo } });
    },
    onError: () => toast.error("Failed to remove item", { icon: ToastIcons.error }),
  });
}
