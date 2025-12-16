// src/features/hub/hooks.ts
"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

// Thread purpose types - determines default actions and external app links
export type ThreadPurpose =
  | "general"
  | "budget"
  | "reminder"
  | "shopping"
  | "travel"
  | "health"
  | "notes"
  | "other";

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
  // New fields for external app integration
  purpose: ThreadPurpose;
  external_url: string | null;
  external_app_name: string | null;
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
  created_at: string;
  reply_to_id: string | null;
  // New fields for read receipts
  status?: "sent" | "delivered" | "read"; // For messages I sent
  is_unread?: boolean; // For messages I received
  // New fields for soft delete
  deleted_at?: string | null;
  deleted_by?: string | null;
  hidden_for?: string[];
  is_hidden_by_me?: boolean; // True if current user has hidden this message
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
    staleTime: 30000, // 30 seconds - balance between freshness and performance
    gcTime: 60000, // Keep in cache for 1 minute
    refetchOnWindowFocus: true, // Refresh when user comes back to app
    refetchOnMount: true, // Refetch on mount only if stale
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
      purpose,
      external_url,
      external_app_name,
    }: {
      title: string;
      description?: string;
      icon?: string;
      household_id: string;
      purpose?: ThreadPurpose;
      external_url?: string;
      external_app_name?: string;
    }) => {
      const res = await fetch("/api/hub/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          icon,
          household_id,
          purpose,
          external_url,
          external_app_name,
        }),
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
// No more polling needed - realtime handles updates!
export function useHubMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["hub", "messages", threadId],
    queryFn: async () => {
      if (!threadId)
        return {
          messages: [],
          message_actions: [],
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
        message_actions: any[]; // Actions included in response - no separate API call needed
        thread_id: string;
        household_id: string;
        current_user_id: string;
        first_unread_message_id: string | null;
        unread_count: number;
        marked_as_read_ids?: string[]; // IDs of messages that were marked as read
      };
    },
    enabled: !!threadId,
    staleTime: 30000, // 30 seconds - realtime handles live updates
    gcTime: 60000, // Keep in cache for 1 minute
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Refetch on mount only if stale
  });
}

// Hook to mark a message as read via API
// This is more reliable than client-side Supabase calls
export function useMarkMessageAsRead() {
  return useCallback(async (messageId: string) => {
    try {
      await fetch("/api/hub/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });
    } catch (err) {
      // Silent fail
    }
  }, []);
}

// Hook to broadcast receipt status updates when messages are marked as read
export function useBroadcastReceiptUpdate() {
  return useCallback(
    async (
      threadId: string,
      messageIds: string[],
      status: string,
      userId: string
    ) => {
      // Filter out messages we've already broadcasted receipts for
      const newMessageIds = messageIds.filter(
        (id) => !broadcastedReceiptIds.has(id)
      );

      if (!newMessageIds.length) {
        return;
      }

      // Mark these as broadcasted BEFORE sending to prevent race conditions
      newMessageIds.forEach((id) => broadcastedReceiptIds.add(id));

      const supabase = supabaseBrowser();
      const channelName = `thread-${threadId}`;

      try {
        // Get or create channel
        const existingChannel = supabase
          .getChannels()
          .find((ch) => ch.topic === `realtime:${channelName}`);

        if (existingChannel) {
          await existingChannel.send({
            type: "broadcast",
            event: "receipt-update",
            payload: { messageIds: newMessageIds, status, userId },
          });
        } else {
          const channel = supabase.channel(channelName);
          await channel.subscribe();
          await channel.send({
            type: "broadcast",
            event: "receipt-update",
            payload: { messageIds: newMessageIds, status, userId },
          });
        }
      } catch (err) {
        // On error, remove from set so we can retry
        newMessageIds.forEach((id) => broadcastedReceiptIds.delete(id));
      }
    },
    []
  );
}

// Store pending receipts for messages that haven't arrived in cache yet
const pendingReceipts = new Map<string, string>(); // messageId -> status

// Track which message IDs we've already broadcasted read receipts for (to avoid duplicates)
const broadcastedReceiptIds = new Set<string>();

// Clear broadcasted receipt tracking (call when switching threads)
export function clearBroadcastedReceipts() {
  broadcastedReceiptIds.clear();
}

// Store active channel subscriptions globally to survive React Strict Mode
const activeChannels = new Map<
  string,
  {
    channel: ReturnType<ReturnType<typeof supabaseBrowser>["channel"]>;
    refCount: number;
  }
>();

// Realtime subscription using Broadcast (no RLS limitations!)
// postgres_changes has RLS issues with subqueries, so we use broadcast instead
export function useRealtimeMessages(
  threadId: string | null,
  onNewMessageFromOther?: (messageId: string) => void
) {
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Store threadId in a ref to avoid recreating the callback
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  // Store callback in ref to avoid recreating handleNewMessage
  const onNewMessageFromOtherRef = useRef(onNewMessageFromOther);
  onNewMessageFromOtherRef.current = onNewMessageFromOther;

  const handleNewMessage = useCallback(
    (payload: { new: HubMessage }) => {
      const currentThreadId = threadIdRef.current;
      const newMessage = payload.new;

      // Only process messages for the current thread
      if (newMessage.thread_id !== currentThreadId) {
        return;
      }

      // Update the messages cache optimistically
      queryClient.setQueryData(
        ["hub", "messages", currentThreadId],
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

          // If this message is from someone else, notify the callback
          // so we can mark it as read immediately
          if (newMessage.sender_user_id !== oldData.current_user_id) {
            onNewMessageFromOtherRef.current?.(newMessage.id);
          }

          return {
            ...oldData,
            messages: [...oldData.messages, newMessage],
          };
        }
      );

      // Update thread's last_message in cache (don't refetch - badge might be stale)
      queryClient.setQueryData(
        ["hub", "threads"],
        (
          oldData:
            | {
                threads: Array<{
                  id: string;
                  last_message: {
                    id: string;
                    content: string | null;
                    sender_user_id: string;
                    created_at: string;
                  } | null;
                  last_message_at: string;
                  unread_count: number;
                  [key: string]: unknown;
                }>;
                household_id: string | null;
                current_user_id: string;
              }
            | undefined
        ) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            threads: oldData.threads.map((t) =>
              t.id === currentThreadId
                ? {
                    ...t,
                    last_message: {
                      id: newMessage.id,
                      content: newMessage.content,
                      sender_user_id: newMessage.sender_user_id,
                      created_at: newMessage.created_at,
                    },
                    last_message_at: newMessage.created_at,
                    // Don't increment unread - we're viewing the chat right now
                    // The message will be marked as read immediately
                  }
                : t
            ),
          };
        }
      );
    },
    [queryClient]
  );

  // Handle receipt status updates (sent → delivered → read)
  const handleReceiptUpdate = useCallback(
    (payload: { messageIds: string[]; status: string; userId: string }) => {
      const currentThreadId = threadIdRef.current;
      const { messageIds, status, userId: receiptFromUserId } = payload;

      // Update the message statuses in cache
      queryClient.setQueryData(
        ["hub", "messages", currentThreadId],
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

          // Ignore our own receipt broadcasts - we only care when OTHERS read OUR messages
          if (receiptFromUserId === oldData.current_user_id) {
            return oldData;
          }

          let updatedCount = 0;
          const messageIdsSet = new Set(messageIds);
          const messageIdsInCache = new Set(oldData.messages.map((m) => m.id));

          const updatedMessages = oldData.messages.map((msg) => {
            const isInList = messageIdsSet.has(msg.id);
            const isMySentMessage =
              msg.sender_user_id === oldData.current_user_id;
            const needsUpdate = msg.status !== status;

            if (isInList && isMySentMessage && needsUpdate) {
              updatedCount++;
              return {
                ...msg,
                status: status as HubMessage["status"],
              };
            }
            return msg;
          });

          // Store pending receipts for messages not yet in cache
          for (const msgId of messageIds) {
            if (!messageIdsInCache.has(msgId) && !msgId.startsWith("temp-")) {
              pendingReceipts.set(msgId, status);
            }
          }

          if (updatedCount === 0) {
            return oldData;
          }

          return {
            ...oldData,
            messages: updatedMessages,
          };
        }
      );
    },
    [queryClient]
  );

  useEffect(() => {
    if (!threadId) {
      setIsSubscribed(false);
      return;
    }

    const supabase = supabaseBrowser();
    const channelName = `thread-${threadId}`;

    // Check if we already have an active channel for this thread
    const existing = activeChannels.get(channelName);
    if (existing) {
      // Increment ref count and reuse
      existing.refCount++;
      setIsSubscribed(true);

      return () => {
        // Use setTimeout to allow React Strict Mode remount to increment refCount first
        setTimeout(() => {
          const entry = activeChannels.get(channelName);
          if (entry) {
            entry.refCount--;
            if (entry.refCount <= 0) {
              supabase.removeChannel(entry.channel);
              activeChannels.delete(channelName);
              setIsSubscribed(false);
            }
          }
        }, 100);
      };
    }

    // Create new channel
    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "new-message" }, (payload) => {
        if (payload.payload) {
          handleNewMessage({ new: payload.payload as HubMessage });
        }
      })
      .on("broadcast", { event: "receipt-update" }, (payload) => {
        if (payload.payload) {
          handleReceiptUpdate(
            payload.payload as {
              messageIds: string[];
              status: string;
              userId: string;
            }
          );
        }
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
        } else if (status === "CHANNEL_ERROR") {
        }
      });

    // Store in global map with refCount=1
    activeChannels.set(channelName, { channel, refCount: 1 });

    return () => {
      // Use setTimeout to allow React Strict Mode remount to increment refCount first
      setTimeout(() => {
        const entry = activeChannels.get(channelName);
        if (entry) {
          entry.refCount--;
          if (entry.refCount <= 0) {
            supabase.removeChannel(entry.channel);
            activeChannels.delete(channelName);
            setIsSubscribed(false);
          }
        }
      }, 100);
    };
  }, [threadId, handleNewMessage, handleReceiptUpdate]);

  return { isSubscribed };
}

// Household-level subscription for thread list updates
// This subscribes when viewing the thread list (no specific thread open)
// so users receive notifications about new messages in ANY thread
export function useHouseholdRealtimeMessages(householdId: string | null) {
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!householdId) {
      setIsSubscribed(false);
      return;
    }

    const supabase = supabaseBrowser();
    const channelName = `household-${householdId}`;

    // Check if we already have an active channel
    const existing = activeChannels.get(channelName);
    if (existing) {
      existing.refCount++;
      setIsSubscribed(true);

      return () => {
        // Use setTimeout to allow React Strict Mode remount to increment refCount first
        setTimeout(() => {
          const entry = activeChannels.get(channelName);
          if (entry) {
            entry.refCount--;
            if (entry.refCount <= 0) {
              supabase.removeChannel(entry.channel);
              activeChannels.delete(channelName);
              setIsSubscribed(false);
            }
          }
        }, 100);
      };
    }

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "new-message" }, (payload) => {
        if (payload.payload) {
          const newMessage = payload.payload as HubMessage;

          // Invalidate threads to refresh the list with new message preview
          queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
        }
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
        } else if (status === "CHANNEL_ERROR") {
        }
      });

    activeChannels.set(channelName, { channel, refCount: 1 });

    return () => {
      // Use setTimeout to allow React Strict Mode remount to increment refCount first
      setTimeout(() => {
        const entry = activeChannels.get(channelName);
        if (entry) {
          entry.refCount--;
          if (entry.refCount <= 0) {
            supabase.removeChannel(entry.channel);
            activeChannels.delete(channelName);
            setIsSubscribed(false);
          }
        }
      }, 100);
    };
  }, [householdId, queryClient]);

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
      const data = await res.json();

      // Broadcast the new message to other clients via Supabase Realtime
      if (data.message) {
        const supabase = supabaseBrowser();
        const threadChannelName = `thread-${thread_id}`;
        const householdChannelName = `household-${data.message.household_id}`;

        // Broadcast to thread channel (for users inside the thread)
        const existingThreadChannel = supabase
          .getChannels()
          .find((ch) => ch.topic === `realtime:${threadChannelName}`);

        if (existingThreadChannel) {
          await existingThreadChannel.send({
            type: "broadcast",
            event: "new-message",
            payload: data.message,
          });
        } else {
          const channel = supabase.channel(threadChannelName);
          await channel.subscribe();
          await channel.send({
            type: "broadcast",
            event: "new-message",
            payload: data.message,
          });
        }

        // Also broadcast to household channel (for users viewing thread list)
        const existingHouseholdChannel = supabase
          .getChannels()
          .find((ch) => ch.topic === `realtime:${householdChannelName}`);

        if (existingHouseholdChannel) {
          await existingHouseholdChannel.send({
            type: "broadcast",
            event: "new-message",
            payload: data.message,
          });
        } else {
          const channel = supabase.channel(householdChannelName);
          await channel.subscribe();
          await channel.send({
            type: "broadcast",
            event: "new-message",
            payload: data.message,
          });
        }
      }

      return data;
    },
    // Optimistic update - add message to cache immediately
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["hub", "messages", variables.thread_id],
      });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData([
        "hub",
        "messages",
        variables.thread_id,
      ]);

      // Get current user ID from cache
      const currentData = previousMessages as
        | { current_user_id: string; messages: HubMessage[] }
        | undefined;
      const currentUserId = currentData?.current_user_id;

      if (currentUserId) {
        // Optimistically add the new message
        const optimisticMessage: HubMessage = {
          id: `temp-${Date.now()}`, // Temporary ID
          household_id: "",
          thread_id: variables.thread_id,
          sender_user_id: currentUserId,
          message_type: "text",
          content: variables.content,
          transaction_id: null,
          goal_id: null,
          alert_id: null,
          created_at: new Date().toISOString(),
          reply_to_id: null,
          status: "sent", // Show as sent immediately
        };

        queryClient.setQueryData(
          ["hub", "messages", variables.thread_id],
          (old: typeof currentData) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...old.messages, optimisticMessage],
            };
          }
        );
      }

      return { previousMessages };
    },
    // On success, replace the optimistic message with the real one
    onSuccess: (data, variables) => {
      if (data.message) {
        // Check for any pending receipts for this message
        const pendingStatus = pendingReceipts.get(data.message.id);
        if (pendingStatus) {
          pendingReceipts.delete(data.message.id);
        }

        // Message is now confirmed saved on server = "delivered"
        // Unless we already have a read receipt pending, use "delivered"
        const finalStatus = pendingStatus || "delivered";

        queryClient.setQueryData(
          ["hub", "messages", variables.thread_id],
          (
            old: { messages: HubMessage[]; [key: string]: unknown } | undefined
          ) => {
            if (!old) return old;
            // Remove any temp messages and add the real one
            const filteredMessages = old.messages.filter(
              (m) => !m.id.startsWith("temp-")
            );
            // Check if real message already exists (from broadcast)
            const existingIndex = filteredMessages.findIndex(
              (m) => m.id === data.message.id
            );
            if (existingIndex >= 0) {
              // Update existing message with final status
              const updated = [...filteredMessages];
              updated[existingIndex] = {
                ...filteredMessages[existingIndex],
                status: finalStatus as HubMessage["status"],
              };
              return { ...old, messages: updated };
            }
            return {
              ...old,
              messages: [
                ...filteredMessages,
                { ...data.message, status: finalStatus },
              ],
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    },
    // On error, roll back to previous state
    onError: (_, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["hub", "messages", variables.thread_id],
          context.previousMessages
        );
      }
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
