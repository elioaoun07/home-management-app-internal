/**
 * Unified Notifications Hooks
 * Provides hooks for fetching and managing notifications (both in-app and push)
 */
import type {
  InAppNotification,
  Notification,
  NotificationType,
} from "@/app/api/notifications/in-app/route";
import type { NotificationPreference } from "@/app/api/notifications/preferences/route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query keys
export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
  // Legacy alias
  inApp: () => notificationKeys.list(),
};

// Types - re-export from API
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

export {
  type InAppNotification,
  type Notification,
  type NotificationPreference,
  type NotificationType,
};

// No more sync needed - all notifications are in one table now

// Fetch notifications
export function useInAppNotifications(options?: {
  limit?: number;
  includeRead?: boolean;
  enabled?: boolean;
  type?: NotificationType;
  excludeActioned?: boolean; // Exclude notifications with completed actions (for sidebar)
  autoArchiveHours?: number; // Auto-hide read info notifications older than X hours
}) {
  const {
    limit = 20,
    includeRead = true,
    enabled = true,
    type,
    excludeActioned = false,
    autoArchiveHours = 0,
  } = options || {};

  return useQuery({
    queryKey: [
      ...notificationKeys.list(),
      { limit, includeRead, type, excludeActioned, autoArchiveHours },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        include_read: includeRead.toString(),
      });
      if (type) params.set("type", type);
      if (excludeActioned) params.set("exclude_actioned", "true");
      if (autoArchiveHours > 0)
        params.set("auto_archive_hours", autoArchiveHours.toString());

      const res = await fetch(`/api/notifications/in-app?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<{
        notifications: Notification[];
        unread_count: number;
      }>;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Poll every minute
    enabled,
  });
}

// Alias for backward compatibility
export const useNotifications = useInAppNotifications;

// Get just the unread count (lightweight query)
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await fetch(
        "/api/notifications/in-app?limit=0&include_read=false",
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
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n,
          ),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
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
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
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
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

// Dismiss notification (fully removes from both sidebar and Hub Alerts)
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
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
        if (!old) return old;
        const notification = old.notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          notifications: old.notifications.filter(
            (n) => n.id !== notificationId,
          ),
          unread_count: wasUnread
            ? Math.max(0, old.unread_count - 1)
            : old.unread_count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

// Archive notification (removes from sidebar but keeps in Hub Alerts)
// Used for info-only notifications that don't have actions
export function useArchiveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: notificationId,
          action_completed: true, // This triggers action_completed_at to be set
          is_read: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
        if (!old) return old;
        const notification = old.notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          notifications: old.notifications.filter(
            (n) => n.id !== notificationId,
          ),
          unread_count: wasUnread
            ? Math.max(0, old.unread_count - 1)
            : old.unread_count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      // Don't invalidate hub alerts - we want archived notifications to stay there
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
    onMutate: async ({ notificationId }) => {
      // Optimistically remove from sidebar immediately
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
        if (!old) return old;
        const notification = old.notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          notifications: old.notifications.filter(
            (n) => n.id !== notificationId,
          ),
          unread_count: wasUnread
            ? Math.max(0, old.unread_count - 1)
            : old.unread_count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      // Also invalidate hub alerts so it shows there
      queryClient.invalidateQueries({ queryKey: ["hub", "alerts"] });
    },
  });
}

// Snooze notification
export function useSnoozeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notificationId,
      snoozedUntil,
    }: {
      notificationId: string;
      snoozedUntil: string; // ISO date string
    }) => {
      const res = await fetch("/api/notifications/in-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: notificationId,
          snoozed_until: snoozedUntil,
        }),
      });
      if (!res.ok) throw new Error("Failed to snooze");
      return res.json();
    },
    onMutate: async ({ notificationId }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });

      queryClient.setQueriesData<{
        notifications: Notification[];
        unread_count: number;
      }>({ queryKey: notificationKeys.list() }, (old) => {
        if (!old) return old;
        const notification = old.notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notification && !notification.is_read;
        return {
          ...old,
          notifications: old.notifications.filter(
            (n) => n.id !== notificationId,
          ),
          unread_count: wasUnread
            ? Math.max(0, old.unread_count - 1)
            : old.unread_count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
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
      preference: Partial<NotificationPreference> & { preference_key: string },
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
  actionType: NotificationActionType | null,
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

// Valid page routes in the app (not tab-based navigation)
const VALID_PAGE_ROUTES = [
  "/dashboard",
  "/expense",
  "/recurring",
  "/settings",
  "/quick-expense",
];

// Helper to get action route
export function getActionRoute(notification: Notification): string | null {
  // First check action_url (new unified field)
  if (notification.action_url) {
    // Validate the action_url - only allow known valid page routes
    // Invalid routes like /transactions/[id], /items/[id], /reminders/[id], /hub?...
    // should fall through to type-based routing
    const url = notification.action_url;

    // Check if it's a valid page route
    if (
      VALID_PAGE_ROUTES.some(
        (route) => url === route || url.startsWith(route + "/"),
      )
    ) {
      return url;
    }

    // Invalid action_url - fall through to type-based routing
  }

  // Fallback to action_data.route for backward compatibility (with same validation)
  if (notification.action_data?.route) {
    const route = notification.action_data.route as string;
    if (
      VALID_PAGE_ROUTES.some((r) => route === r || route.startsWith(r + "/"))
    ) {
      return route;
    }
  }

  // Map notification types to tab navigation routes
  // These are handled specially in the notification click handler
  switch (notification.notification_type) {
    case "daily_reminder":
    case "transaction_pending":
      return "/expense"; // Tab: expense
    case "budget_warning":
    case "budget_exceeded":
      return "/budget"; // Tab: dashboard
    case "bill_due":
    case "bill_overdue":
      return "/recurring"; // Page route (valid)
    case "item_reminder":
    case "item_due":
    case "item_overdue":
      return "/reminder"; // Tab: reminder
    case "goal_milestone":
    case "goal_completed":
    case "chat_message":
    case "chat_mention":
      return "/hub"; // Tab: hub
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
