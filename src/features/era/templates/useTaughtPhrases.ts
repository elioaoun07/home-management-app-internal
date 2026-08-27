"use client";

// src/features/era/templates/useTaughtPhrases.ts
// ERA Stage 4 (HUB-30) — mutations for the "Taught phrases" management
// surface (inspect/disable/delete). Read side reuses useEraTemplates's
// query key so a toggle/delete here invalidates the same cache the router's
// matcher reads from.
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eraKeys } from "../queryKeys";
import type { EraTemplateRow } from "./useEraTemplates";

export function useSetTemplateEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await safeFetch(`/api/era/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eraKeys.templates() }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/era/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eraKeys.templates() }),
  });

  const undoRecreate = useMutation({
    mutationFn: async (row: EraTemplateRow) => {
      const res = await safeFetch("/api/era/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capabilityId: row.capability_id,
          patternText: row.pattern_text,
          slotNames: row.slot_names,
          sourceText: row.source_text,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eraKeys.templates() }),
  });

  /** Hard Rule #1 — delete with Undo. Re-teaching from the row's own data recreates an equivalent template. */
  function deleteWithUndo(row: EraTemplateRow) {
    remove.mutate(row.id, {
      onSuccess: () => {
        toast.success("Phrase forgotten", {
          icon: ToastIcons.success,
          duration: 4000,
          description: `"${row.pattern_text}"`,
          action: {
            label: "Undo",
            onClick: () => undoRecreate.mutate(row),
          },
        });
      },
    });
  }

  return { deleteWithUndo, isDeleting: remove.isPending };
}
