/**
 * NotificationModal Component
 * Sheet/modal for displaying notifications with action buttons
 * Features:
 * - Notification list with icons and timestamps
 * - Action buttons based on notification type
 * - "View All" footer linking to Hub > Alerts
 * - Swipe to dismiss on mobile
 */
"use client";

import { AlertBellIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTab } from "@/contexts/TabContext";
import {
  getActionButtonText,
  getActionRoute,
  getPriorityBorderColor,
  useCompleteNotificationAction,
  useDismissNotification,
  useInAppNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type InAppNotification,
} from "@/hooks/useNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { CheckCircle, ExternalLink, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";

type NotificationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NotificationModal({
  open,
  onOpenChange,
}: NotificationModalProps) {
  const router = useRouter();
  const { setActiveTab, setHubDefaultView } = useTab();
  const themeClasses = useThemeClasses();

  const { data, isLoading } = useInAppNotifications({
    limit: 20,
    includeRead: true,
    enabled: open, // Only fetch when modal is open
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const completeAction = useCompleteNotificationAction();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  const handleNotificationClick = (notification: InAppNotification) => {
    // Mark as read
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    // Get route if applicable
    const route = getActionRoute(
      notification.action_type,
      notification.action_data
    );

    if (route) {
      onOpenChange(false);

      // Handle tab navigation
      if (route === "/expense") {
        setActiveTab("expense");
      } else if (route === "/budget") {
        setActiveTab("dashboard");
      } else if (route.startsWith("/hub")) {
        setActiveTab("hub");
      } else {
        router.push(route);
      }
    }
  };

  const handleActionClick = (notification: InAppNotification) => {
    // Complete the action
    completeAction.mutate({
      notificationId: notification.id,
      dismiss:
        notification.action_type === "confirm" ||
        notification.action_type === "dismiss",
    });

    // Handle navigation if needed
    const route = getActionRoute(
      notification.action_type,
      notification.action_data
    );
    if (
      route &&
      notification.action_type !== "confirm" &&
      notification.action_type !== "dismiss"
    ) {
      onOpenChange(false);

      if (route === "/expense") {
        setActiveTab("expense");
      } else if (route === "/budget") {
        setActiveTab("dashboard");
      } else if (route.startsWith("/hub")) {
        setActiveTab("hub");
      } else {
        router.push(route);
      }
    }
  };

  const handleDismiss = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    dismiss.mutate(notificationId);
  };

  const handleViewAll = () => {
    onOpenChange(false);
    // Set the hub default view before navigating
    setHubDefaultView("alerts");
    setActiveTab("hub");
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  };

  const getNotificationIcon = (notification: InAppNotification): string => {
    if (notification.icon && notification.icon.length <= 4) {
      return notification.icon; // Emoji
    }

    // Map icon names to emojis
    switch (notification.icon) {
      case "bell":
        return "🔔";
      case "transaction":
      case "log_transaction":
        return "📝";
      case "budget":
        return "💰";
      case "warning":
        return "⚠️";
      case "alert":
        return "🚨";
      case "success":
        return "✅";
      case "info":
        return "ℹ️";
      case "task":
        return "✔️";
      case "reminder":
        return "⏰";
      default:
        return "🔔";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col bg-[hsl(var(--header-bg))] border-l border-white/10"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle
              className={cn(
                "text-lg font-semibold flex items-center gap-2",
                themeClasses.headerText
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
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs text-white/60 hover:text-white"
              >
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {isLoading ? (
            // Loading skeleton
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
                className={cn("text-lg font-semibold mb-2", themeClasses.text)}
              >
                All Caught Up!
              </h3>
              <p className="text-sm text-white/50 max-w-[200px]">
                You have no new notifications. Check back later!
              </p>
            </div>
          ) : (
            // Notification list
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "group relative p-4 rounded-xl transition-all duration-200 cursor-pointer",
                  "bg-white/5 hover:bg-white/10 border",
                  getPriorityBorderColor(notification.priority),
                  !notification.is_read &&
                    "bg-white/8 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                    {getNotificationIcon(notification)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={cn(
                          "text-sm font-medium",
                          notification.is_read ? "text-white/70" : "text-white"
                        )}
                      >
                        {notification.title}
                      </h4>

                      {/* Dismiss button */}
                      <button
                        onClick={(e) => handleDismiss(e, notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-white/10 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white/40 hover:text-white/70" />
                      </button>
                    </div>

                    {notification.message && (
                      <p className="text-sm text-white/50 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-white/30">
                        {formatTime(notification.created_at)}
                      </span>

                      {/* Action button */}
                      {notification.action_type &&
                        !notification.action_completed_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick(notification);
                            }}
                            className={cn(
                              "h-7 px-3 text-xs font-medium",
                              notification.action_type === "log_transaction" &&
                                "bg-primary/20 text-primary hover:bg-primary/30",
                              notification.action_type === "view_details" &&
                                "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
                              notification.action_type === "complete_task" &&
                                "bg-green-500/20 text-green-400 hover:bg-green-500/30",
                              notification.action_type === "confirm" &&
                                "bg-white/10 text-white/70 hover:bg-white/20"
                            )}
                          >
                            {getActionButtonText(notification.action_type)}
                            {(notification.action_type === "log_transaction" ||
                              notification.action_type === "view_details") && (
                              <ExternalLink className="w-3 h-3 ml-1" />
                            )}
                          </Button>
                        )}

                      {notification.action_completed_at && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unread indicator */}
                {!notification.is_read && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            ))
          )}
        </div>

        <SheetFooter className="px-4 py-4 border-t border-white/10">
          <Button
            onClick={handleViewAll}
            variant="outline"
            className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
          >
            View All in Hub
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
