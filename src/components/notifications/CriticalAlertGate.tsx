/**
 * Critical Alert Gate — full-screen takeover for unacted, high/urgent,
 * takeover-eligible notifications (registry `takeoverEligible: true`, e.g.
 * overdue items/bills, budget exceeded). Mounted once in the root layout so
 * it appears on every app open and every focus regain, guaranteeing these
 * alerts get seen even if the push notification was missed, delayed, or the
 * device was offline (Hard Rule 15: opaque panel, no glass).
 *
 * "Later" only hides the gate for the current app session (component
 * state) — it reappears on next app open/reload if the alert is still
 * unacted. Acting on an alert always shows an Undo toast (Hard Rule 1).
 */
"use client";

import {
  getQuickActions,
  isTakeoverEligible,
  renderNotificationIcon,
  renderQuickActionIcon,
} from "@/lib/notifications/registry";
import {
  useInAppNotifications,
  useNotificationNavigation,
  useNotificationQuickAction,
  useNotificationsRealtime,
  type Notification,
  type QuickAction,
} from "@/hooks/useNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function CriticalAlertGate() {
  const tc = useThemeClasses();
  const queryClient = useQueryClient();
  useNotificationsRealtime();

  const { data } = useInAppNotifications({
    limit: 20,
    includeRead: true,
    excludeActioned: true,
  });
  const quickAction = useNotificationQuickAction();
  const navigate = useNotificationNavigation();

  const [dismissedForSession, setDismissedForSession] = useState<Set<string>>(
    new Set(),
  );

  const critical = (data?.notifications || []).filter(
    (n) =>
      !dismissedForSession.has(n.id) &&
      isTakeoverEligible(n.notification_type) &&
      (n.priority === "high" || n.priority === "urgent"),
  );

  if (critical.length === 0) return null;

  const undo = async (notification: Notification) => {
    await safeFetch("/api/notifications/in-app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: notification.id,
        is_read: false,
        is_dismissed: false,
        action_completed: false,
        snoozed_until: null,
      }),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const showUndoToast = (notification: Notification, label: string) => {
    toast.success(label, {
      icon: ToastIcons.success,
      duration: 4000,
      action: { label: "Undo", onClick: () => undo(notification) },
    });
  };

  const handleAction = (notification: Notification, qa: QuickAction) => {
    switch (qa.id) {
      case "open":
      case "log_transaction":
      case "view_budget":
      case "open_split_bill":
      case "reply":
        navigate(notification);
        if (qa.closesNotification) {
          quickAction.mutate({ notificationId: notification.id, action: "read" });
        }
        break;
      case "complete_task":
        quickAction.mutate(
          { notificationId: notification.id, action: "complete_task" },
          { onSuccess: () => showUndoToast(notification, "Marked complete") },
        );
        break;
      case "confirm":
        quickAction.mutate(
          { notificationId: notification.id, action: "confirm" },
          { onSuccess: () => showUndoToast(notification, "Confirmed") },
        );
        break;
      case "dismiss":
        quickAction.mutate(
          { notificationId: notification.id, action: "dismiss" },
          { onSuccess: () => showUndoToast(notification, "Dismissed") },
        );
        break;
      case "snooze_15m":
        quickAction.mutate(
          { notificationId: notification.id, action: "snooze", snoozeMinutes: 15 },
          { onSuccess: () => showUndoToast(notification, "Snoozed 15m") },
        );
        break;
      case "snooze_1h":
        quickAction.mutate(
          { notificationId: notification.id, action: "snooze", snoozeMinutes: 60 },
          { onSuccess: () => showUndoToast(notification, "Snoozed 1h") },
        );
        break;
      case "snooze_tomorrow":
        quickAction.mutate(
          { notificationId: notification.id, action: "snooze", snoozeMinutes: 60 * 24 },
          { onSuccess: () => showUndoToast(notification, "Snoozed until tomorrow") },
        );
        break;
    }
  };

  const handleLater = () => {
    setDismissedForSession(
      (prev) => new Set([...prev, ...critical.map((n) => n.id)]),
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("fixed inset-0 z-[9999] flex flex-col overflow-y-auto", tc.bgPage)}
      >
        <div className="flex-1 flex flex-col px-5 pt-10 pb-6 max-w-lg mx-auto w-full">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-white mb-1">
              {critical.length === 1 ? "1 thing needs you" : `${critical.length} things need you`}
            </h1>
            <p className="text-sm text-white/50">
              Take care of these before you carry on.
            </p>
          </div>

          <div className="flex-1 space-y-3">
            {critical.map((notification) => {
              const actions = getQuickActions(notification);
              return (
                <div
                  key={notification.id}
                  className="p-4 rounded-xl neo-card bg-bg-card-custom border border-red-500/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {renderNotificationIcon(notification.notification_type, "w-6 h-6")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-sm text-white/60 mt-0.5">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-white/30 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pl-9">
                    {actions.map((qa) => (
                      <button
                        key={qa.id}
                        onClick={() => handleAction(notification, qa)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          qa.variant === "primary" &&
                            "bg-primary/20 text-primary hover:bg-primary/30",
                          qa.variant === "success" &&
                            "bg-green-500/20 text-green-400 hover:bg-green-500/30",
                          qa.variant === "neutral" &&
                            "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25",
                          qa.variant === "muted" &&
                            "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        {renderQuickActionIcon(qa.icon)}
                        {qa.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleLater}
            className="mt-6 w-full py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            Later
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
