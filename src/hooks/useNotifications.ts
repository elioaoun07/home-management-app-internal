/**
 * In-App Notifications Hooks
 * Provides hooks for fetching and managing in-app notifications
 */
import type { InAppNotification } from "@/app/api/notifications/in-app/route";
import type { NotificationPreference } from "@/app/api/notifications/preferences/route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query keys
export const notificationKeys = {
  all: ["notifications"] as const,
  inApp: () => [...notificationKeys.all, "in-app"] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
  unreadCount: () => [...notificationKeys.inApp(), "unread-count"] as const,
};

// Types
export type NotificationActionType =
  | "confirm"
  | "complete_task"
  | "log_transaction"
  | "view_details"
  | "snooze"
  | "dismiss";

export type NotificationSource =
  | "system"
  | "cron"
  | "alert"
  | "item"
  | "transaction"
  | "budget"
  | "household";

export { type InAppNotification, type NotificationPreference };

// Sync notifications from cron/push to in-app on mount
async function syncNotifications(): Promise<void> {
  try {
    await fetch("/api/notifications/sync", { method: "POST" });
  } catch (error) {
    // Silently fail - sync is best effort
    console.debug("Notification sync failed:", error);
  }
}

// Fetch in-app notifications
export function useInAppNotifications(options?: {
  limit?: number;
  includeRead?: boolean;
  enabled?: boolean;
}) {
  const { limit = 10, includeRead = true, enabled = true } = options || {};

  return useQuery({
    queryKey: [...notificationKeys.inApp(), { limit, includeRead }],
    queryFn: async () => {
      // Sync notifications from cron/push first (non-blocking)
      syncNotifications();

      const params = new URLSearchParams({
        limit: limit.toString(),
        include_read: includeRead.toString(),
      });
      const res = await fetch(`/api/notifications/in-app?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<{
        notifications: InAppNotification[];
        unread_count: number;
      }>;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Poll every minute for new notifications
    enabled,
  });
}

// Get just the unread count (lightweight query)
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await fetch(
        "/api/notifications/in-app?limit=0&include_read=false"
      );
      if (!res.ok) throw new Error("Failed to fetch notification count");
      const data = await res.json();
      return data.unread_count as number;
    },
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId, is_read: true }),
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onMutate: async (notificationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: notificationKeys.inApp() });

      queryClient.setQueriesData<{
        notifications: InAppNotification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.inApp() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.inApp() });
    },
  });
}

// Mark all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: notificationIds, is_read: true }),
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.inApp() });

      queryClient.setQueriesData<{
        notifications: InAppNotification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.inApp() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) => ({
            ...n,
            is_read: true,
          })),
          unread_count: 0,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.inApp() });
    },
  });
}

// Dismiss notification
export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId, is_dismissed: true }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.inApp() });

      queryClient.setQueriesData<{
        notifications: InAppNotification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.inApp() }, (old) => {
        if (!old) return old;
        const notification = old.notifications.find(
          (n) => n.id === notificationId
        );
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          notifications: old.notifications.filter(
            (n) => n.id !== notificationId
          ),
          unread_count: wasUnread
            ? Math.max(0, old.unread_count - 1)
            : old.unread_count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.inApp() });
    },
  });
}

// Complete notification action
export function useCompleteNotificationAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notificationId,
      dismiss = false,
    }: {
      notificationId: string;
      dismiss?: boolean;
    }) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: notificationId,
          action_completed: true,
          is_read: true,
          is_dismissed: dismiss,
        }),
      });
      if (!res.ok) throw new Error("Failed to complete action");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.inApp() });
    },
  });
}

// Fetch notification preferences
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json() as Promise<{
        preferences: NotificationPreference[];
        templates: Array<{
          template_key: string;
          title: string;
          message_template: string | null;
          icon: string;
          default_action_type: NotificationActionType | null;
          default_priority: string;
          default_frequency: string;
          default_time: string;
          is_system: boolean;
        }>;
      }>;
    },
    staleTime: 60000, // 1 minute
  });
}

// Update notification preference
export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      preference: Partial<NotificationPreference> & { preference_key: string }
    ) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preference),
      });
      if (!res.ok) throw new Error("Failed to update preference");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.preferences(),
      });
    },
  });
}

// Helper to get action button text
export function getActionButtonText(
  actionType: NotificationActionType | null
): string {
  switch (actionType) {
    case "confirm":
      return "Got it";
    case "complete_task":
      return "Mark Complete";
    case "log_transaction":
      return "Log Now";
    case "view_details":
      return "View";
    case "snooze":
      return "Snooze";
    case "dismiss":
      return "Dismiss";
    default:
      return "Dismiss";
  }
}

// Helper to get action route
export function getActionRoute(
  actionType: NotificationActionType | null,
  actionData?: Record<string, unknown> | null
): string | null {
  switch (actionType) {
    case "log_transaction":
      return "/expense"; // Navigate to expense tab
    case "view_details":
      if (actionData?.route) return actionData.route as string;
      if (
        actionData?.alert_type === "budget_warning" ||
        actionData?.alert_type === "budget_exceeded"
      ) {
        return "/budget";
      }
      return "/hub?view=alerts";
    default:
      return null;
  }
}

// Helper to get priority color
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "text-red-500";
    case "high":
      return "text-orange-500";
    case "normal":
      return "text-blue-500";
    case "low":
      return "text-gray-400";
    default:
      return "text-white/60";
  }
}

// Helper to get priority border color
export function getPriorityBorderColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "border-red-500/30";
    case "high":
      return "border-orange-500/30";
    case "normal":
      return "border-blue-500/30";
    case "low":
      return "border-gray-500/30";
    default:
      return "border-white/10";
  }
}
