// src/features/hub/hooks.ts
"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

// Types
export type HubChatThread = {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  description: string | null;
  icon: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message: {
    id: string;
    content: string | null;
    sender_user_id: string;
    created_at: string;
  } | null;
  unread_count: number;
};

export type HubMessage = {
  id: string;
  household_id: string;
  thread_id: string;
  sender_user_id: string;
  message_type: "text" | "system" | "transaction" | "goal" | "alert";
  content: string | null;
  transaction_id: string | null;
  goal_id: string | null;
  alert_id: string | null;
  is_read: boolean;
  created_at: string;
  reply_to_id: string | null;
  // New fields for read receipts
  status?: "sent" | "delivered" | "read"; // For messages I sent
  is_unread?: boolean; // For messages I received
};

export type HubFeedItem = {
  id: string;
  household_id: string;
  user_id: string;
  activity_type: string;
  transaction_id: string | null;
  goal_id: string | null;
  title: string;
  subtitle: string | null;
  amount: number | null;
  icon: string | null;
  color: string | null;
  created_at: string;
};

export type HubAlert = {
  id: string;
  user_id: string;
  household_id: string | null;
  alert_type: string;
  severity: "action" | "warning" | "info" | "success";
  title: string;
  message: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  action_taken: boolean;
  created_at: string;
  expires_at: string | null;
};

export type HubStats = {
  logging_streak: number;
  total_spent_month: number;
  household: {
    partner_email: string;
    partner_streak: number;
    partner_total_spent: number;
  } | null;
  current_user_id: string;
};

// --- Chat Threads ---
export function useHubThreads() {
  return useQuery({
    queryKey: ["hub", "threads"],
    queryFn: async () => {
      const res = await fetch("/api/hub/threads");
      if (!res.ok) throw new Error("Failed to fetch threads");
      const data = await res.json();
      return data as {
        threads: HubChatThread[];
        household_id: string | null;
        current_user_id: string;
      };
    },
    staleTime: 60000, // 1 minute - realtime handles updates via invalidation
    refetchOnWindowFocus: true, // Refresh when user comes back to app
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      icon,
      household_id,
    }: {
      title: string;
      description?: string;
      icon?: string;
      household_id: string;
    }) => {
      const res = await fetch("/api/hub/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, icon, household_id }),
      });
      if (!res.ok) throw new Error("Failed to create thread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    },
  });
}

// --- Messages (within a thread) ---
// Polls for updates every 5 seconds when chat is open (for receipt status changes)
export function useHubMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["hub", "messages", threadId],
    queryFn: async () => {
      if (!threadId)
        return {
          messages: [],
          thread_id: null,
          household_id: null,
          current_user_id: "",
          first_unread_message_id: null,
          unread_count: 0,
        };
      const res = await fetch(`/api/hub/messages?thread_id=${threadId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return data as {
        messages: HubMessage[];
        thread_id: string;
        household_id: string;
        current_user_id: string;
        first_unread_message_id: string | null;
        unread_count: number;
      };
    },
    enabled: !!threadId,
    staleTime: 3000, // Consider stale after 3 seconds
    refetchInterval: 5000, // Poll every 5 seconds for receipt status updates
    refetchOnWindowFocus: true,
  });
}

// Realtime subscription for messages - push-based, no polling!
export function useRealtimeMessages(threadId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<
    ReturnType<typeof supabaseBrowser>["channel"]
  > | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleNewMessage = useCallback(
    (payload: { new: HubMessage }) => {
      const newMessage = payload.new;

      // Only process messages for the current thread
      if (newMessage.thread_id !== threadId) return;

      // Update the messages cache optimistically
      queryClient.setQueryData(
        ["hub", "messages", threadId],
        (
          oldData:
            | {
                messages: HubMessage[];
                thread_id: string;
                household_id: string;
                current_user_id: string;
              }
            | undefined
        ) => {
          if (!oldData) return oldData;

          // Check if message already exists (avoid duplicates)
          const exists = oldData.messages.some((m) => m.id === newMessage.id);
          if (exists) return oldData;

          return {
            ...oldData,
            messages: [...oldData.messages, newMessage],
          };
        }
      );

      // Also update threads list to show latest message
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    },
    [threadId, queryClient]
  );

  useEffect(() => {
    if (!threadId) {
      setIsSubscribed(false);
      return;
    }

    const supabase = supabaseBrowser();

    // Create a unique channel name for this thread
    const channelName = `hub-messages-${threadId}`;

    // Subscribe to new messages only - receipt status is handled by polling
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hub_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          handleNewMessage(payload as unknown as { new: HubMessage });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or thread change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
      }
    };
  }, [threadId, handleNewMessage]);

  return { isSubscribed };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      thread_id,
    }: {
      content: string;
      thread_id: string;
    }) => {
      const res = await fetch("/api/hub/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, thread_id }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["hub", "messages", variables.thread_id],
      });
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    },
  });
}

// --- Feed ---
export function useHubFeed() {
  return useQuery({
    queryKey: ["hub", "feed"],
    queryFn: async () => {
      const res = await fetch("/api/hub/feed");
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data = await res.json();
      return data as {
        feed: HubFeedItem[];
        household_id: string | null;
        current_user_id: string;
      };
    },
    staleTime: 60000, // 1 minute
  });
}

// --- Alerts ---
export function useHubAlerts() {
  return useQuery({
    queryKey: ["hub", "alerts"],
    queryFn: async () => {
      const res = await fetch("/api/hub/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data = await res.json();
      return data as { alerts: HubAlert[] };
    },
    staleTime: 60000, // 1 minute
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch("/api/hub/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, is_dismissed: true }),
      });
      if (!res.ok) throw new Error("Failed to dismiss alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", "alerts"] });
    },
  });
}

// --- Stats ---
export function useHubStats() {
  return useQuery({
    queryKey: ["hub", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/hub/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<HubStats>;
    },
    staleTime: 300000, // 5 minutes
  });
}
