// src/features/healthcare/hooks.ts
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { healthcareKeys, householdAllergenKeys } from "./queryKeys";
import type {
  CreateHealthAllergyDTO,
  CreateHealthConditionDTO,
  CreateHealthMedicationDTO,
  CreateHealthProfileDTO,
  CreateHealthVaccineDTO,
  HealthAllergy,
  HealthBundle,
  HealthCondition,
  HealthMedication,
  HealthMedicationLog,
  HealthProfile,
  HealthVaccine,
  SaveHealthMedicationDTO,
  SetMedicationDoseDTO,
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
  medications: [],
  medication_logs: [],
};

// Medication writes also create/replace reminder items and sync them to
// Google Calendar server-side — well past safeFetch's 8 s default.
const REMINDER_SYNC_TIMEOUT_MS = 30_000;

async function requestJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  timeoutMs?: number,
): Promise<T> {
  const res = await safeFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
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
  // Spread so a bundle from an older RPC (pre-medications) still has every key.
  return { ...EMPTY_BUNDLE, ...(data.bundle ?? {}) };
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

/** Medication writes change Schedule reminder items too. */
function useInvalidateHealthAndSchedule() {
  const queryClient = useQueryClient();
  const invalidateHealth = useInvalidateHealth();
  return () => {
    invalidateHealth();
    queryClient.invalidateQueries({ queryKey: qk.scheduleItems() });
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
  // Deleting a profile also stops its medication reminders.
  const invalidate = useInvalidateHealthAndSchedule();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ profile: HealthProfile }>(
        `/api/healthcare/profiles/${id}`,
        "DELETE",
        undefined,
        REMINDER_SYNC_TIMEOUT_MS,
      ),
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
              undefined,
              REMINDER_SYNC_TIMEOUT_MS,
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

// ── Medications ──────────────────────────────────────────────────────────────

/** The full editable payload of an existing medication (for Undo). */
export function medicationToSaveDTO(m: HealthMedication): SaveHealthMedicationDTO {
  return {
    name: m.name,
    dosage: m.dosage,
    mode: m.mode,
    food_timing: m.food_timing,
    dose_times: m.dose_times,
    timezone: m.timezone,
    starts_at: new Date(m.starts_at).toISOString(),
    ends_at: m.ends_at ? new Date(m.ends_at).toISOString() : null,
    min_hours_between: m.min_hours_between,
    max_per_day: m.max_per_day,
    notes: m.notes,
  };
}

export function useCreateHealthMedication() {
  const invalidate = useInvalidateHealthAndSchedule();
  return useMutation({
    mutationFn: (payload: CreateHealthMedicationDTO) =>
      requestJson<{ medication: HealthMedication }>(
        "/api/healthcare/medications",
        "POST",
        payload,
        REMINDER_SYNC_TIMEOUT_MS,
      ),
    onSuccess: ({ medication }) => {
      toast.success(`${medication.name} added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(
              `/api/healthcare/medications/${medication.id}`,
              "DELETE",
              undefined,
              REMINDER_SYNC_TIMEOUT_MS,
            );
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add medication"),
    onSettled: invalidate,
  });
}

export function useUpdateHealthMedication() {
  const invalidate = useInvalidateHealthAndSchedule();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: SaveHealthMedicationDTO;
      previous: SaveHealthMedicationDTO;
    }) =>
      requestJson<{ medication: HealthMedication }>(
        `/api/healthcare/medications/${id}`,
        "PATCH",
        data,
        REMINDER_SYNC_TIMEOUT_MS,
      ),
    onSuccess: ({ medication }, { id, previous }) => {
      toast.success(`${medication.name} updated`, {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await requestJson(
              `/api/healthcare/medications/${id}`,
              "PATCH",
              previous,
              REMINDER_SYNC_TIMEOUT_MS,
            );
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update medication"),
    onSettled: invalidate,
  });
}

export function useDeleteHealthMedication() {
  const invalidate = useInvalidateHealthAndSchedule();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<{ medication: HealthMedication }>(
        `/api/healthcare/medications/${id}`,
        "DELETE",
        undefined,
        REMINDER_SYNC_TIMEOUT_MS,
      ),
    onSuccess: ({ medication }) => {
      toast.success(`${medication.name} removed`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            // Soft delete → restore brings the reminders back; history was kept.
            await requestJson(
              `/api/healthcare/medications/${medication.id}?restore=true`,
              "DELETE",
              undefined,
              REMINDER_SYNC_TIMEOUT_MS,
            );
            invalidate();
          },
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to remove medication"),
    onSettled: invalidate,
  });
}

function sameInstant(a: string | null, b: string | null | undefined): boolean {
  return !!a && !!b && new Date(a).getTime() === new Date(b).getTime();
}

/**
 * Mark / un-mark a dose. Optimistic on the bundle so the checkbox flips
 * instantly. Course doses get no toast (the checkbox is its own undo); an
 * as-needed "Take" gets one with Undo.
 */
export function useSetMedicationDose() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateHealthAndSchedule();

  const mutation = useMutation({
    mutationFn: ({
      medication_id,
      taken,
      scheduled_at,
      log_id,
      taken_at,
    }: SetMedicationDoseDTO & { label?: string }) =>
      requestJson<{ log: HealthMedicationLog | null }>(
        `/api/healthcare/medications/${medication_id}/doses`,
        "POST",
        { taken, scheduled_at, log_id, taken_at },
      ),
    onMutate: async (dto) => {
      await queryClient.cancelQueries({ queryKey: healthcareKeys.bundle() });
      const prev = queryClient.getQueryData<HealthBundle>(healthcareKeys.bundle());
      if (prev) {
        const logs = prev.medication_logs ?? [];
        const now = new Date().toISOString();
        const next = dto.taken
          ? [
              {
                id: dto.log_id ?? `optimistic-${dto.medication_id}-${dto.scheduled_at}`,
                medication_id: dto.medication_id,
                managing_user_id: "",
                scheduled_at: dto.scheduled_at ?? null,
                taken_at: dto.taken_at ?? now,
                created_at: now,
              },
              ...logs,
            ]
          : logs.filter(
              (l) =>
                l.medication_id !== dto.medication_id ||
                (dto.scheduled_at
                  ? !sameInstant(l.scheduled_at, dto.scheduled_at)
                  : l.id !== dto.log_id),
            );
        queryClient.setQueryData<HealthBundle>(healthcareKeys.bundle(), {
          ...prev,
          medication_logs: next,
        });
      }
      return { prev };
    },
    onSuccess: (_res, dto) => {
      if (!dto.taken || dto.scheduled_at) return;
      toast.success(`${dto.label ?? "Dose"} taken`, {
        icon: ToastIcons.success,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => mutation.mutate({ ...dto, taken: false }),
        },
      });
    },
    onError: (err, _dto, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(healthcareKeys.bundle(), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to update dose");
    },
    onSettled: invalidate,
  });
  return mutation;
}
