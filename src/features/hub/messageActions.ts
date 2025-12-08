// src/features/hub/messageActions.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MessageActionType = "transaction" | "reminder" | "forward" | "pin";

export type MessageAction = {
  id: string;
  message_id: string;
  user_id: string;
  action_type: MessageActionType;
  transaction_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

/**
 * Hook to fetch actions for specific messages via API
 */
export function useMessageActions(messageIds: string[]) {
  return useQuery({
    queryKey: ["hub", "message-actions", ...messageIds.sort()],
    queryFn: async () => {
      if (messageIds.length === 0) return [];

      const response = await fetch(
        `/api/hub/message-actions?messageIds=${messageIds.join(",")}`
      );

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as MessageAction[];
    },
    enabled: messageIds.length > 0,
    staleTime: 1000 * 60, // 1 minute
    retry: false,
  });
}

/**
 * Hook to create a message action via API
 */
export function useCreateMessageAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      actionType,
      transactionId,
      metadata,
    }: {
      messageId: string;
      actionType: MessageActionType;
      transactionId?: string | null;
      metadata?: Record<string, any>;
    }) => {
      const response = await fetch("/api/hub/message-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          actionType,
          transactionId: transactionId || null,
          metadata: metadata || {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create message action");
      }

      const data = await response.json();
      return data as MessageAction;
    },
    onSuccess: () => {
      // Invalidate both message-actions (for backward compat) and messages (where actions are now included)
      queryClient.invalidateQueries({
        queryKey: ["hub", "message-actions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["hub", "messages"],
      });
    },
  });
}

/**
 * Hook to delete a message action via API
 */
export function useDeleteMessageAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const response = await fetch(`/api/hub/message-actions/${actionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete message action");
      }
    },
    onSuccess: () => {
      // Invalidate both message-actions (for backward compat) and messages (where actions are now included)
      queryClient.invalidateQueries({
        queryKey: ["hub", "message-actions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["hub", "messages"],
      });
    },
  });
}
