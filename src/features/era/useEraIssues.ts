"use client";

// src/features/era/useEraIssues.ts
// HUB-85 — file a Report from the ERA chat, and its Undo. The server builds
// the snapshot (transcript, outcomes, ERA actions — src/lib/era/issueReport.ts)
// and stores it as a system row in the conversation; the thread renders that
// row as a "Reported" marker. The PM bridge imports reports into Hub & ERA.

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eraKeys } from "./queryKeys";
import type { EraMessage, EraMessagesPage } from "./useEraConversation";
import { useEraStore } from "./useEraStore";

export interface ReportEraIssueInput {
  conversationId: string;
  messageId: string | null;
  kind: "missed" | "wrong";
  note?: string;
}

function withMessage(queryClient: QueryClient, message: EraMessage): void {
  queryClient.setQueryData<EraMessagesPage>(eraKeys.messages(message.conversation_id), (old) =>
    old
      ? { ...old, messages: [...old.messages.filter((m) => m.id !== message.id), message] }
      : old,
  );
}

function withoutMessage(queryClient: QueryClient, message: EraMessage): void {
  queryClient.setQueryData<EraMessagesPage>(eraKeys.messages(message.conversation_id), (old) =>
    old ? { ...old, messages: old.messages.filter((m) => m.id !== message.id) } : old,
  );
}

export function useReportEraIssue() {
  const queryClient = useQueryClient();

  const undo = async (message: EraMessage) => {
    try {
      const res = await safeFetch(`/api/era/issues/${encodeURIComponent(message.id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      withoutMessage(queryClient, message);
      toast.success("Undone", { icon: ToastIcons.success });
    } catch {
      toast.error("Couldn't undo");
    }
  };

  return useMutation<EraMessage, Error, ReportEraIssueInput>({
    mutationFn: async (input) => {
      const res = await safeFetch("/api/era/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: input.conversationId,
          messageId: input.messageId,
          kind: input.kind,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const { message } = (await res.json()) as { message: EraMessage };
      return message;
    },
    onSuccess: (message) => {
      withMessage(queryClient, message);
      useEraStore.getState().setReportTarget(null);
      toast.success("Reported", {
        icon: ToastIcons.success,
        duration: 4000,
        action: { label: "Undo", onClick: () => void undo(message) },
      });
    },
    onError: () => {
      toast.error("Couldn't send the report");
    },
  });
}
