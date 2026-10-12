// src/hooks/useHealthMeasurements.ts
// Shared Healthcare measurement hooks — Healthcare and Fitness read and write
// the same health_measurements rows through these (no standalone→standalone
// import). Writes need connectivity in v1 (never queued offline).
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import type { CreateMeasurementDTO, HealthMeasurement, UpdateMeasurementDTO } from "@/lib/health/measurements";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const healthMeasurementKeys = {
  all: ["health-measurements"] as const,
  profile: (profileId: string) => [...healthMeasurementKeys.all, profileId] as const,
};
// Fitness bundle carries the self-profile link; profile creation refreshes it.
const FITNESS_ROOT = ["fitness"] as const;
const HEALTHCARE_ROOT = ["healthcare"] as const;

async function request<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
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

export function useHealthMeasurements(profileId: string | null | undefined) {
  return useQuery({
    queryKey: healthMeasurementKeys.profile(profileId ?? "none"),
    enabled: !!profileId,
    queryFn: async (): Promise<HealthMeasurement[]> => {
      if (!isReallyOnline()) throw new Error("Offline");
      const res = await fetch(`/api/healthcare/measurements?profile_id=${profileId}`);
      if (!res.ok) throw new Error("Failed to fetch measurements");
      return (await res.json()).measurements ?? [];
    },
    staleTime: CACHE_TIMES.BALANCE,
    retry: (count, error) => (error?.message === "Offline" ? false : count < 2),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: healthMeasurementKeys.all });
    qc.invalidateQueries({ queryKey: FITNESS_ROOT });
  };
}

export function useCreateMeasurement() {
  const invalidate = useInvalidate();
  const remove = useDeleteMeasurement({ silent: true });
  return useMutation({
    mutationFn: (payload: CreateMeasurementDTO) =>
      request<{ measurement: HealthMeasurement }>("/api/healthcare/measurements", "POST", payload),
    onSuccess: ({ measurement }) => {
      toast.success("Measurement saved", {
        icon: ToastIcons.create,
        duration: 4000,
        action: { label: "Undo", onClick: () => remove.mutate(measurement) },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save", { icon: ToastIcons.error }),
    onSettled: invalidate,
  });
}

export function useUpdateMeasurement() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMeasurementDTO; previous: UpdateMeasurementDTO }) =>
      request<{ measurement: HealthMeasurement }>(`/api/healthcare/measurements/${id}`, "PATCH", data),
    onSuccess: (_r, { id, previous }) => {
      toast.success("Measurement updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => request(`/api/healthcare/measurements/${id}`, "PATCH", previous).then(invalidate, () => toast.error("Undo failed", { icon: ToastIcons.error })),
        },
      });
      qc.invalidateQueries({ queryKey: healthMeasurementKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update", { icon: ToastIcons.error }),
    onSettled: invalidate,
  });
}

export function useDeleteMeasurement(opts: { silent?: boolean } = {}) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (m: HealthMeasurement) => request<{ measurement: HealthMeasurement }>(`/api/healthcare/measurements/${m.id}`, "DELETE"),
    onSuccess: (_r, m) => {
      if (opts.silent) return;
      toast.success("Measurement deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          // Same id: the restore is an idempotent re-create of the exact row.
          onClick: () =>
            request("/api/healthcare/measurements", "POST", {
              id: m.id, profile_id: m.profile_id, measured_at: m.measured_at, weight_kg: m.weight_kg,
              height_cm: m.height_cm, source: m.source, notes: m.notes,
            }).then(invalidate, () => toast.error("Undo failed", { icon: ToastIcons.error })),
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete", { icon: ToastIcons.error }),
    onSettled: invalidate,
  });
}

/** Explicit "This is me" Healthcare profile, offered by Fitness when missing. */
export function useCreateSelfHealthProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      request<{ profile: { id: string; name: string } }>("/api/healthcare/profiles", "POST", { name, is_self: true }),
    onSuccess: ({ profile }) => {
      toast.success("Health profile created", {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            request(`/api/healthcare/profiles/${profile.id}`, "DELETE").then(
              () => { qc.invalidateQueries({ queryKey: FITNESS_ROOT }); qc.invalidateQueries({ queryKey: HEALTHCARE_ROOT }); },
              () => toast.error("Undo failed", { icon: ToastIcons.error }),
            ),
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create profile", { icon: ToastIcons.error }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FITNESS_ROOT });
      qc.invalidateQueries({ queryKey: HEALTHCARE_ROOT });
    },
  });
}
