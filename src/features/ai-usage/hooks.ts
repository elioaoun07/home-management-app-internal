// src/features/ai-usage/hooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import type {
  AISessionType,
  AIUsageModel,
  CreateAIModelInput,
  CreateSessionTypeInput,
  UpdateAIModelInput,
  UpdateSessionTypeInput,
} from "@/types/aiUsage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiUsageKeys } from "./queryKeys";

// ============================================
// Fetchers
// ============================================

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let msg = fallback;
    try {
      const j = await res.json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function fetchModels(): Promise<AIUsageModel[]> {
  const res = await fetch("/api/ai-usage/models");
  return parseOrThrow<AIUsageModel[]>(res, "Failed to load AI models");
}

async function fetchSessionTypes(modelId: string): Promise<AISessionType[]> {
  const res = await fetch(`/api/ai-usage/models/${modelId}/session-types`);
  return parseOrThrow<AISessionType[]>(res, "Failed to load session types");
}

// ============================================
// Queries
// ============================================

export function useAIModels() {
  return useQuery({
    queryKey: aiUsageKeys.models(),
    queryFn: fetchModels,
    staleTime: CACHE_TIMES.PREFERENCES,
    refetchOnWindowFocus: false,
  });
}

export function useSessionTypes(modelId: string | null | undefined) {
  return useQuery({
    queryKey: modelId
      ? aiUsageKeys.sessionTypes(modelId)
      : [...aiUsageKeys.all, "session-types", "none"],
    queryFn: () => fetchSessionTypes(modelId as string),
    enabled: !!modelId,
    staleTime: CACHE_TIMES.PREFERENCES,
    refetchOnWindowFocus: false,
  });
}

// ============================================
// Model mutations
// ============================================

export function useCreateAIModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAIModelInput): Promise<AIUsageModel> => {
      const res = await safeFetch("/api/ai-usage/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseOrThrow<AIUsageModel>(res, "Failed to add model");
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
      toast.success(`"${created.name}" added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await safeFetch(`/api/ai-usage/models/${created.id}`, {
                method: "DELETE",
              });
              qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
              toast.success("Removed", { icon: ToastIcons.delete });
            } catch {
              toast.error("Failed to undo", { icon: ToastIcons.error });
            }
          },
        },
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add model", {
        icon: ToastIcons.error,
      });
    },
  });
}

export function useUpdateAIModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & UpdateAIModelInput,
    ): Promise<{ updated: AIUsageModel; previous: AIUsageModel | null }> => {
      const { id, ...patch } = input;
      const previous =
        qc
          .getQueryData<AIUsageModel[]>(aiUsageKeys.models())
          ?.find((m) => m.id === id) ?? null;
      const res = await safeFetch(`/api/ai-usage/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const updated = await parseOrThrow<AIUsageModel>(
        res,
        "Failed to update model",
      );
      return { updated, previous };
    },
    onSuccess: ({ updated, previous }) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
      toast.success(`"${updated.name}" updated`, {
        icon: ToastIcons.update,
        duration: 4000,
        action: previous
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  await safeFetch(`/api/ai-usage/models/${updated.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: previous.name,
                      refresh_frequency: previous.refresh_frequency,
                      cycle_start_date: previous.cycle_start_date,
                      current_usage_pct: Number(previous.current_usage_pct),
                      notes: previous.notes,
                      position: previous.position,
                    }),
                  });
                  qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
                  toast.success("Reverted", { icon: ToastIcons.update });
                } catch {
                  toast.error("Failed to undo", { icon: ToastIcons.error });
                }
              },
            }
          : undefined,
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update model",
        { icon: ToastIcons.error },
      );
    },
  });
}

export function useDeleteAIModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      id: string,
    ): Promise<{
      id: string;
      previous: AIUsageModel | null;
      types: AISessionType[];
    }> => {
      const previous =
        qc
          .getQueryData<AIUsageModel[]>(aiUsageKeys.models())
          ?.find((m) => m.id === id) ?? null;
      const types =
        qc.getQueryData<AISessionType[]>(aiUsageKeys.sessionTypes(id)) ?? [];

      const res = await safeFetch(`/api/ai-usage/models/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        await parseOrThrow(res, "Failed to delete model");
      }
      return { id, previous, types };
    },
    onSuccess: ({ id, previous, types }) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
      qc.removeQueries({ queryKey: aiUsageKeys.sessionTypes(id) });
      toast.success(`"${previous?.name ?? "Model"}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: previous
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  // Recreate the model, then its session types.
                  const createRes = await safeFetch("/api/ai-usage/models", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: previous.name,
                      refresh_frequency: previous.refresh_frequency,
                      cycle_start_date: previous.cycle_start_date,
                      current_usage_pct: Number(previous.current_usage_pct),
                      notes: previous.notes,
                    }),
                  });
                  const recreated = await parseOrThrow<AIUsageModel>(
                    createRes,
                    "Failed to undo",
                  );
                  await Promise.all(
                    types.map((t) =>
                      safeFetch(
                        `/api/ai-usage/models/${recreated.id}/session-types`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: t.name,
                            estimated_usage_pct: Number(t.estimated_usage_pct),
                          }),
                        },
                      ),
                    ),
                  );
                  qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
                  toast.success("Restored", { icon: ToastIcons.create });
                } catch {
                  toast.error("Failed to undo", { icon: ToastIcons.error });
                }
              },
            }
          : undefined,
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete model",
        { icon: ToastIcons.error },
      );
    },
  });
}

/**
 * Manual "Reset cycle" — wipes usage % and advances cycle_start_date to today.
 */
export function useResetAIModelCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<AIUsageModel> => {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const res = await safeFetch(`/api/ai-usage/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_start_date: iso,
          current_usage_pct: 0,
        }),
      });
      return parseOrThrow<AIUsageModel>(res, "Failed to reset cycle");
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
      toast.success(`Cycle reset for "${m.name}"`, {
        icon: ToastIcons.update,
        duration: 4000,
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset cycle",
        { icon: ToastIcons.error },
      );
    },
  });
}

// ============================================
// Session type mutations
// ============================================

export function useCreateSessionType(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateSessionTypeInput,
    ): Promise<AISessionType> => {
      const res = await safeFetch(
        `/api/ai-usage/models/${modelId}/session-types`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return parseOrThrow<AISessionType>(res, "Failed to add session type");
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.sessionTypes(modelId) });
      toast.success(`"${created.name}" added`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await safeFetch(
                `/api/ai-usage/models/${modelId}/session-types/${created.id}`,
                { method: "DELETE" },
              );
              qc.invalidateQueries({
                queryKey: aiUsageKeys.sessionTypes(modelId),
              });
              toast.success("Removed", { icon: ToastIcons.delete });
            } catch {
              toast.error("Failed to undo", { icon: ToastIcons.error });
            }
          },
        },
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to add session type",
        { icon: ToastIcons.error },
      );
    },
  });
}

export function useUpdateSessionType(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & UpdateSessionTypeInput,
    ): Promise<{ updated: AISessionType; previous: AISessionType | null }> => {
      const { id, ...patch } = input;
      const previous =
        qc
          .getQueryData<AISessionType[]>(aiUsageKeys.sessionTypes(modelId))
          ?.find((t) => t.id === id) ?? null;
      const res = await safeFetch(
        `/api/ai-usage/models/${modelId}/session-types/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const updated = await parseOrThrow<AISessionType>(
        res,
        "Failed to update session type",
      );
      return { updated, previous };
    },
    onSuccess: ({ updated, previous }) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.sessionTypes(modelId) });
      toast.success(`"${updated.name}" updated`, {
        icon: ToastIcons.update,
        duration: 4000,
        action: previous
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  await safeFetch(
                    `/api/ai-usage/models/${modelId}/session-types/${updated.id}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: previous.name,
                        estimated_usage_pct: Number(
                          previous.estimated_usage_pct,
                        ),
                      }),
                    },
                  );
                  qc.invalidateQueries({
                    queryKey: aiUsageKeys.sessionTypes(modelId),
                  });
                  toast.success("Reverted", { icon: ToastIcons.update });
                } catch {
                  toast.error("Failed to undo", { icon: ToastIcons.error });
                }
              },
            }
          : undefined,
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update session type",
        { icon: ToastIcons.error },
      );
    },
  });
}

export function useDeleteSessionType(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      id: string,
    ): Promise<{ id: string; previous: AISessionType | null }> => {
      const previous =
        qc
          .getQueryData<AISessionType[]>(aiUsageKeys.sessionTypes(modelId))
          ?.find((t) => t.id === id) ?? null;
      const res = await safeFetch(
        `/api/ai-usage/models/${modelId}/session-types/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) await parseOrThrow(res, "Failed to delete session type");
      return { id, previous };
    },
    onSuccess: ({ previous }) => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.sessionTypes(modelId) });
      toast.success(`"${previous?.name ?? "Session type"}" deleted`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: previous
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  await safeFetch(
                    `/api/ai-usage/models/${modelId}/session-types`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: previous.name,
                        estimated_usage_pct: Number(
                          previous.estimated_usage_pct,
                        ),
                      }),
                    },
                  );
                  qc.invalidateQueries({
                    queryKey: aiUsageKeys.sessionTypes(modelId),
                  });
                  toast.success("Restored", { icon: ToastIcons.create });
                } catch {
                  toast.error("Failed to undo", { icon: ToastIcons.error });
                }
              },
            }
          : undefined,
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete session type",
        { icon: ToastIcons.error },
      );
    },
  });
}

// ============================================
// Silent auto-advance (no toast, no Undo)
// Called from the page when a model's cycle has rolled over.
// ============================================

export function useAutoAdvanceAIModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; cycle_start_date: string }) => {
      const res = await safeFetch(`/api/ai-usage/models/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_start_date: input.cycle_start_date,
          current_usage_pct: 0,
        }),
      });
      return parseOrThrow<AIUsageModel>(res, "Failed to auto-advance cycle");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiUsageKeys.models() });
    },
  });
}
