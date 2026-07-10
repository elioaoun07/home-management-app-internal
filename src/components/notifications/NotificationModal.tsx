/**
 * NotificationModal Component
 * Drawer panel for displaying notifications with action buttons.
 * Animation is hand-rolled with Framer Motion directly on top of the Radix
 * Dialog primitive (not the shared shadcn Sheet) — the Sheet's CSS-keyframe
 * animation (tailwindcss-animate) fought with the panel's mount cost and
 * produced a janky, double-motion open. Framer Motion drives a single
 * transform-only drawer animation; cached content renders immediately, and
 * skeleton rows are reserved for genuine loading states.
 * Features:
 * - Notification list with icons and timestamps
 * - Action buttons based on notification type
 * - "View All" footer linking to Hub > Alerts
 * - Swipe to dismiss on mobile
 */
"use client";

import { AlertBellIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { useSplitBillModal } from "@/contexts/SplitBillContext";
import { useTab } from "@/contexts/TabContext";
import {
  getActionRoute,
  getPriorityBorderColor,
  getQuickActions,
  useArchiveNotification,
  useCompleteNotificationAction,
  useDismissNotification,
  useInAppNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationQuickAction,
  type Notification,
  type QuickAction,
} from "@/hooks/useNotifications";
import { renderNotificationIcon } from "@/lib/notifications/registry";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Info,
  MessageSquare,
  MoreHorizontal,
  Send,
  Sparkles,
  SplitSquareHorizontal,
  Wallet,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type NotificationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NotificationModal({
  open,
  onOpenChange,
}: NotificationModalProps) {
  const router = useRouter();
  const { setActiveTab } = useTab();
  const themeClasses = useThemeClasses();
  const { openSplitBillModal } = useSplitBillModal();

  const { data, isLoading } = useInAppNotifications({
    limit: 20,
    includeRead: true,
    excludeActioned: true, // Hide notifications that have been acted upon
    autoArchiveHours: 24, // Auto-hide read info notifications after 24 hours
    enabled: open, // Only fetch when modal is open
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const archive = useArchiveNotification();
  const completeAction = useCompleteNotificationAction();
  const quickAction = useNotificationQuickAction();
  const prefersReducedMotion = useReducedMotion();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  // Which row's secondary-actions overflow menu is open (one at a time)
  const [openOverflowId, setOpenOverflowId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setOpenOverflowId(null);
  }, [open]);

  // Check if notification is info-only (no action or action already completed)
  const isInfoOnly = (notification: Notification) => {
    return (
      !notification.action_type || notification.action_completed_at !== null
    );
  };

  // Navigate to the notification's natural target (used by body click + "open" quick action)
  const navigateForNotification = (notification: Notification) => {
    // Split bill modal pre-population
    if (
      notification.notification_type === "transaction_pending" &&
      notification.action_data
    ) {
      const splitData = notification.action_data as {
        transaction_id?: string;
        owner_amount?: number;
        owner_description?: string;
        category_name?: string;
      };

      if (splitData.transaction_id) {
        openSplitBillModal({
          transaction_id: splitData.transaction_id,
          owner_amount: splitData.owner_amount || 0,
          owner_description: splitData.owner_description || "",
          category_name: splitData.category_name || "Expense",
        });
        onOpenChange(false);
        return;
      }
    }

    const route = getActionRoute(notification);
    if (!route) return;

    onOpenChange(false);

    try {
      const url = new URL(route, window.location.origin);
      const tab = url.searchParams.get("tab");
      const action = url.searchParams.get("action");

      if (tab === "dashboard") {
        setActiveTab("dashboard");
      } else if (tab === "reminder") {
        setActiveTab("reminder");
      } else if (tab === "hub") {
        router.push("/alerts");
      } else if (route === "/expense" || action === "add-expense") {
        setActiveTab("expense");
      } else if (action === "split-bill") {
        setActiveTab("expense");
      } else if (
        route.startsWith("/chat") ||
        route.startsWith("/recurring") ||
        route.startsWith("/reminders") ||
        route.startsWith("/focus") ||
        route.startsWith("/catalogue")
      ) {
        router.push(route);
      } else {
        router.push(route);
      }
    } catch {
      router.push(route);
    }
  };

  // Handle a quick-action button (multi-action row)
  const handleQuickAction = (notification: Notification, qa: QuickAction) => {
    // Mark as read if unread
    if (!notification.is_read) markRead.mutate(notification.id);

    switch (qa.id) {
      case "open":
      case "log_transaction":
      case "view_budget":
      case "open_split_bill":
      case "reply":
        navigateForNotification(notification);
        // Also clear the notification once acted upon
        if (qa.closesNotification) {
          completeAction.mutate({
            notificationId: notification.id,
            dismiss: false,
          });
        }
        break;

      case "complete_task":
        quickAction.mutate({
          notificationId: notification.id,
          action: "complete_task",
        });
        break;

      case "confirm":
        quickAction.mutate({
          notificationId: notification.id,
          action: "confirm",
        });
        break;

      case "dismiss":
        quickAction.mutate({
          notificationId: notification.id,
          action: "dismiss",
        });
        break;

      case "snooze_15m":
        quickAction.mutate({
          notificationId: notification.id,
          action: "snooze",
          snoozeMinutes: 15,
        });
        break;
      case "snooze_1h":
        quickAction.mutate({
          notificationId: notification.id,
          action: "snooze",
          snoozeMinutes: 60,
        });
        break;
      case "snooze_tomorrow":
        quickAction.mutate({
          notificationId: notification.id,
          action: "snooze",
          snoozeMinutes: 60 * 24,
        });
        break;
    }
  };

  const renderQuickActionIcon = (icon: QuickAction["icon"]) => {
    switch (icon) {
      case "send":
        return <Send className="w-3 h-3" />;
      case "check":
        return <CheckCircle className="w-3 h-3" />;
      case "clock":
        return <Clock className="w-3 h-3" />;
      case "x":
        return <X className="w-3 h-3" />;
      case "eye":
        return <Eye className="w-3 h-3" />;
      case "wallet":
        return <Wallet className="w-3 h-3" />;
      case "split":
        return <SplitSquareHorizontal className="w-3 h-3" />;
      case "reply":
        return <MessageSquare className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    // Handle split bill notifications specially
    if (
      notification.notification_type === "transaction_pending" &&
      notification.action_data
    ) {
      const splitData = notification.action_data as {
        transaction_id?: string;
        owner_amount?: number;
        owner_description?: string;
        category_name?: string;
      };

      if (splitData.transaction_id) {
        openSplitBillModal({
          transaction_id: splitData.transaction_id,
          owner_amount: splitData.owner_amount || 0,
          owner_description: splitData.owner_description || "",
          category_name: splitData.category_name || "Expense",
        });
        onOpenChange(false);
        return;
      }
    }

    // Get route from the notification
    const route = getActionRoute(notification);

    if (route) {
      onOpenChange(false);

      // Parse route to check for tab-based navigation via deep link params
      try {
        const url = new URL(route, window.location.origin);
        const tab = url.searchParams.get("tab");
        const action = url.searchParams.get("action");

        if (tab === "dashboard") {
          setActiveTab("dashboard");
        } else if (tab === "reminder") {
          setActiveTab("reminder");
        } else if (tab === "hub") {
          router.push("/alerts");
        } else if (route === "/expense" || action === "add-expense") {
          setActiveTab("expense");
        } else if (action === "split-bill") {
          setActiveTab("expense");
          // SplitBillHandler will pick up pending splits
        } else if (
          route.startsWith("/chat") ||
          route.startsWith("/recurring") ||
          route.startsWith("/reminders") ||
          route.startsWith("/focus") ||
          route.startsWith("/catalogue")
        ) {
          // Standalone pages → real navigation
          router.push(route);
        } else {
          router.push(route);
        }
      } catch {
        router.push(route);
      }
    }
  };

  const handleDismiss = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    // For info-only notifications, archive them (removes from sidebar but keeps in Hub Alerts)
    // For actionable notifications, fully dismiss them
    if (isInfoOnly(notification)) {
      archive.mutate(notification.id);
    } else {
      dismiss.mutate(notification.id);
    }
  };

  const handleViewAll = () => {
    onOpenChange(false);
    router.push("/alerts");
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  };

  const getNotificationIcon = (notification: Notification): ReactNode => {
    // Type-based icon: single source of truth is the notification registry
    // (shared with the /alerts page — same icon per type everywhere).
    if (notification.notification_type) {
      return renderNotificationIcon(notification.notification_type, "w-5 h-5");
    }

    // Fallback to icon field mapping
    switch (notification.icon) {
      case "bell":
        return <Bell className="w-5 h-5 text-yellow-400" />;
      case "transaction":
      case "log_transaction":
        return <FileText className="w-5 h-5 text-cyan-400" />;
      case "split":
        return <ArrowLeftRight className="w-5 h-5 text-blue-400" />;
      case "check":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "budget":
        return <Wallet className="w-5 h-5 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "alert":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-400" />;
      case "task":
        return <CheckSquare className="w-5 h-5 text-emerald-400" />;
      case "reminder":
        return <Clock className="w-5 h-5 text-orange-400" />;
      default:
        return <Bell className="w-5 h-5 text-yellow-400" />;
    }
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md flex flex-col bg-[hsl(var(--header-bg))] border-l border-white/10 shadow-lg will-change-transform outline-none"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
                }
              >
                <Dialog.Description className="sr-only">
                  Your notifications
                </Dialog.Description>

                <Dialog.Close className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </Dialog.Close>

                <div className="flex flex-col gap-1.5 px-4 pt-4 pb-2 pr-12">
                  <div className="flex items-center justify-between">
                    <Dialog.Title
                      className={cn(
                        "text-lg font-semibold flex items-center gap-2",
                        themeClasses.headerText,
                      )}
                    >
                      <AlertBellIcon
                        size={20}
                        showDot={false}
                        className={themeClasses.text}
                      />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Dialog.Title>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllRead}
                        className="text-xs text-white/60 hover:text-white whitespace-nowrap"
                      >
                        Mark all read
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                  {isLoading ? (
                    // Cheap skeleton for genuine loading states only. Cached
                    // notifications render immediately so opening stays one motion.
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-white/5 border border-white/5 animate-pulse"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/10 rounded w-3/4" />
                              <div className="h-3 bg-white/5 rounded w-full" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : notifications.length === 0 ? (
                    // Empty state with celebration
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-green-400" />
                        </div>
                        <CheckCircle className="absolute -bottom-1 -right-1 w-6 h-6 text-green-500" />
                      </div>
                      <h3
                        className={cn(
                          "text-lg font-semibold mb-2",
                          themeClasses.text,
                        )}
                      >
                        All Caught Up!
                      </h3>
                      <p className="text-sm text-white/50 max-w-[200px]">
                        You have no new notifications. Check back later!
                      </p>
                    </div>
                  ) : (
                    // Notification list — one info tier: icon + title + short context + time.
                    // Full message text lives on the alerts page, not here (Decision 3).
                    notifications.map((notification) => {
                      const [primaryAction, ...overflowActions] =
                        notification.action_completed_at
                          ? []
                          : getQuickActions(notification);
                      const isOverflowOpen = openOverflowId === notification.id;

                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "group relative p-3 rounded-xl transition-all duration-200 cursor-pointer",
                            "bg-white/5 hover:bg-white/10 border",
                            getPriorityBorderColor(notification.priority),
                            !notification.is_read &&
                              "bg-white/8 border-l-2 border-l-primary",
                            // Lift the active row above its siblings so its overflow
                            // menu doesn't paint underneath the next row down.
                            isOverflowOpen && "z-10",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                              {getNotificationIcon(notification)}
                            </div>

                            {/* Single info tier: title gets its own full-width line so
                        it never gets crushed by a sibling competing for space;
                        context + time share the line below. */}
                            <div className="flex-1 min-w-0">
                              <h4
                                className={cn(
                                  "text-sm font-medium truncate",
                                  notification.is_read
                                    ? "text-white/70"
                                    : "text-white",
                                )}
                              >
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                                {notification.message && (
                                  <span className="text-white/40 truncate min-w-0">
                                    {notification.message}
                                  </span>
                                )}
                                <span className="text-white/30 flex-shrink-0">
                                  {formatTime(notification.created_at)}
                                </span>
                                {notification.action_completed_at && (
                                  <span className="flex items-center gap-1 text-green-400 flex-shrink-0">
                                    <CheckCircle className="w-3 h-3" />
                                    Done
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Compact actions: one primary icon button + overflow for the rest */}
                            {primaryAction && (
                              <div
                                className="relative flex items-center gap-1 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() =>
                                    handleQuickAction(
                                      notification,
                                      primaryAction,
                                    )
                                  }
                                  aria-label={primaryAction.label}
                                  title={primaryAction.label}
                                  className={cn(
                                    "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
                                    primaryAction.variant === "primary" &&
                                      "bg-primary/20 text-primary hover:bg-primary/30",
                                    primaryAction.variant === "success" &&
                                      "bg-green-500/20 text-green-400 hover:bg-green-500/30",
                                    primaryAction.variant === "neutral" &&
                                      "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25",
                                    primaryAction.variant === "muted" &&
                                      "bg-white/5 text-white/60 hover:bg-white/10",
                                  )}
                                >
                                  {renderQuickActionIcon(primaryAction.icon)}
                                </button>

                                {overflowActions.length > 0 && (
                                  <>
                                    <button
                                      onClick={() =>
                                        setOpenOverflowId(
                                          isOverflowOpen
                                            ? null
                                            : notification.id,
                                        )
                                      }
                                      aria-label="More actions"
                                      title="More actions"
                                      className="flex items-center justify-center w-7 h-7 rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>

                                    {isOverflowOpen && (
                                      <div
                                        className={cn(
                                          "absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-white/10 shadow-lg py-1",
                                          themeClasses.bgPage,
                                        )}
                                      >
                                        {overflowActions.map((qa) => (
                                          <button
                                            key={qa.id}
                                            onClick={() => {
                                              handleQuickAction(
                                                notification,
                                                qa,
                                              );
                                              setOpenOverflowId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white text-left"
                                          >
                                            {renderQuickActionIcon(qa.icon)}
                                            {qa.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Dismiss — always visible (not hover-only) so it works on touch */}
                            <button
                              onClick={(e) => handleDismiss(e, notification)}
                              aria-label="Dismiss notification"
                              title="Dismiss"
                              className="flex-shrink-0 opacity-50 group-hover:opacity-100 active:opacity-100 p-1 rounded-full hover:bg-white/10 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-2 px-4 py-4 border-t border-white/10">
                  <Button
                    onClick={handleViewAll}
                    variant="outline"
                    className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    View All Alerts
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
