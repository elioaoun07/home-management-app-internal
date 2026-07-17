// src/features/healthcare/hooks.ts
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { healthcareKeys, householdAllergenKeys } from "./queryKeys";
import type {
  CreateHealthAllergyDTO,
  CreateHealthConditionDTO,
  CreateHealthProfileDTO,
  CreateHealthVaccineDTO,
  HealthAllergy,
  HealthBundle,
  HealthCondition,
  HealthProfile,
  HealthVaccine,
  UpdateHealthAllergyDTO,
  UpdateHealthConditionDTO,
  UpdateHealthProfileDTO,
  UpdateHealthVaccineDTO,
} from "./types";

const EMPTY_BUNDLE: HealthBundle = {
  profiles: [],
  allergies: [],
  conditions: [],
  vaccines: [],
};

async function requestJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await safeFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Request failed",
    );
  }
  return res.json();
}

// ── Queries ──────────────────────────────────────────────────────────────────

async function fetchHealthBundle(): Promise<HealthBundle> {
  if (!isReallyOnline()) throw new Error("Offline");
  const res = await fetch("/api/healthcare");
  if (!res.ok) throw new Error("Failed to fetch health data");
  const data = await res.json();
  return data.bundle ?? EMPTY_BUNDLE;
}

export function useHealthBundle() {
  return useQuery({
    queryKey: healthcareKeys.bundle(),
    queryFn: fetchHealthBundle,
    staleTime: CACHE_TIMES.BALANCE,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}

// The allergen feed hook itself is shared: src/hooks/useHouseholdAllergens.ts
export { useHouseholdAllergens } from "@/hooks/useHouseholdAllergens";

function useInvalidateHealth() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: healthcareKeys.all });
    queryClient.invalidateQueries({ queryKey: householdAllergenKeys.all });
  };
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export function useCreateHealthProfile() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (payload: CreateHealthProfileDTO) =>
      requestJson<{ profile: HealthProfile }>("/api/healthcare/profiles", "POST", payload),
    onSuccess: ({ profile }) => {
      toast.success(`Profile created for ${profile.name}`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/healthcare/profiles/${profile.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create profile"),
    onSettled: invalidate,
  });
}

export function useUpdateHealthProfile() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateHealthProfileDTO;
      /** Pass the pre-edit values to enable a real Undo. */
      previous?: UpdateHealthProfileDTO;
    }) => requestJson<{ profile: HealthProfile }>(`/api/healthcare/profiles/${id}`, "PATCH", data),
    onSuccess: ({ profile }, { id, previous }) => {
      toast.success(`Profile updated`, {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/healthcare/profiles/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
      void profile;
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update profile"),
    onSettled: invalidate,
  });
}

export function useDeleteHealthProfile() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ profile: HealthProfile }>(`/api/healthcare/profiles/${id}`, "DELETE"),
    onSuccess: ({ profile }) => {
      toast.success(`Profile "${profile.name}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            // Soft delete → restore brings back the profile AND its records.
            await requestJson(
              `/api/healthcare/profiles/${profile.id}?restore=true`,
              "DELETE",
            );
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete profile"),
    onSettled: invalidate,
  });
}

// ── Allergies ────────────────────────────────────────────────────────────────

export function useCreateHealthAllergy() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (payload: CreateHealthAllergyDTO) =>
      requestJson<{ allergy: HealthAllergy }>("/api/healthcare/allergies", "POST", payload),
    onSuccess: ({ allergy }) => {
      toast.success(`Allergy "${allergy.allergen}" added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/healthcare/allergies/${allergy.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add allergy"),
    onSettled: invalidate,
  });
}

export function useUpdateHealthAllergy() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateHealthAllergyDTO;
      previous?: UpdateHealthAllergyDTO;
    }) => requestJson<{ allergy: HealthAllergy }>(`/api/healthcare/allergies/${id}`, "PATCH", data),
    onSuccess: (_res, { id, previous }) => {
      toast.success("Allergy updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/healthcare/allergies/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update allergy"),
    onSettled: invalidate,
  });
}

export function useDeleteHealthAllergy() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ allergy: HealthAllergy }>(`/api/healthcare/allergies/${id}`, "DELETE"),
    onSuccess: ({ allergy }) => {
      toast.success(`Allergy "${allergy.allergen}" removed`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            // Hard delete → Undo re-creates from the returned row.
            await requestJson("/api/healthcare/allergies", "POST", {
              profile_id: allergy.profile_id,
              allergen: allergy.allergen,
              severity: allergy.severity,
              reaction_notes: allergy.reaction_notes,
              keywords: allergy.keywords,
            });
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to remove allergy"),
    onSettled: invalidate,
  });
}

// ── Conditions (medical history) ─────────────────────────────────────────────

export function useCreateHealthCondition() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (payload: CreateHealthConditionDTO) =>
      requestJson<{ condition: HealthCondition }>("/api/healthcare/conditions", "POST", payload),
    onSuccess: ({ condition }) => {
      toast.success(`Record "${condition.title}" added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/healthcare/conditions/${condition.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add record"),
    onSettled: invalidate,
  });
}

export function useUpdateHealthCondition() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateHealthConditionDTO;
      previous?: UpdateHealthConditionDTO;
    }) =>
      requestJson<{ condition: HealthCondition }>(`/api/healthcare/conditions/${id}`, "PATCH", data),
    onSuccess: (_res, { id, previous }) => {
      toast.success("Record updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/healthcare/conditions/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update record"),
    onSettled: invalidate,
  });
}

export function useDeleteHealthCondition() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ condition: HealthCondition }>(`/api/healthcare/conditions/${id}`, "DELETE"),
    onSuccess: ({ condition }) => {
      toast.success(`Record "${condition.title}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson("/api/healthcare/conditions", "POST", {
              profile_id: condition.profile_id,
              kind: condition.kind,
              title: condition.title,
              notes: condition.notes,
              occurred_on: condition.occurred_on,
              status: condition.status,
              catalogue_item_id: condition.catalogue_item_id,
            });
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete record"),
    onSettled: invalidate,
  });
}

// ── Vaccines ─────────────────────────────────────────────────────────────────

export function useCreateHealthVaccine() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (payload: CreateHealthVaccineDTO) =>
      requestJson<{ vaccine: HealthVaccine }>("/api/healthcare/vaccines", "POST", payload),
    onSuccess: ({ vaccine }) => {
      toast.success(`Vaccine "${vaccine.vaccine_name}" added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(`/api/healthcare/vaccines/${vaccine.id}`, "DELETE");
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add vaccine"),
    onSettled: invalidate,
  });
}

export function useUpdateHealthVaccine() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateHealthVaccineDTO;
      previous?: UpdateHealthVaccineDTO;
    }) =>
      requestJson<{ vaccine: HealthVaccine }>(`/api/healthcare/vaccines/${id}`, "PATCH", data),
    onSuccess: (_res, { id, previous }) => {
      toast.success("Vaccine updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previous) {
              await requestJson(`/api/healthcare/vaccines/${id}`, "PATCH", previous);
            }
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update vaccine"),
    onSettled: invalidate,
  });
}

export function useDeleteHealthVaccine() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ vaccine: HealthVaccine }>(`/api/healthcare/vaccines/${id}`, "DELETE"),
    onSuccess: ({ vaccine }) => {
      toast.success(`Vaccine "${vaccine.vaccine_name}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson("/api/healthcare/vaccines", "POST", {
              profile_id: vaccine.profile_id,
              vaccine_name: vaccine.vaccine_name,
              dose_label: vaccine.dose_label,
              administered_on: vaccine.administered_on,
              next_due_on: vaccine.next_due_on,
              provider: vaccine.provider,
              lot_number: vaccine.lot_number,
              notes: vaccine.notes,
              catalogue_item_id: vaccine.catalogue_item_id,
            });
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete vaccine"),
    onSettled: invalidate,
  });
}
