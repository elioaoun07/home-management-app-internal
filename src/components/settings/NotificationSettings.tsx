// src/components/settings/NotificationSettings.tsx
// Component for managing push notification settings

"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NotificationSettings() {
  const themeClasses = useThemeClasses();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isCheckingDue, setIsCheckingDue] = useState(false);

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      toast.success("Push notifications enabled!", {
        description: "You'll receive reminder alerts on this device.",
      });
    } else if (permission === "denied") {
      toast.error("Permission denied", {
        description: "Please enable notifications in your browser settings.",
      });
    }
  };

  const handleUnsubscribe = async () => {
    const success = await unsubscribe();
    if (success) {
      toast.success("Push notifications disabled", {
        description: "You won't receive alerts on this device anymore.",
      });
    }
  };

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    try {
      await sendTestNotification();
      toast.success("Test notification sent!", {
        description: "You should see a notification shortly.",
      });
    } catch (error) {
      toast.error("Failed to send test notification", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCheckDueReminders = async () => {
    setIsCheckingDue(true);
    try {
      const response = await fetch("/api/notifications/send-due", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check due reminders");
      }

      if (data.sent > 0) {
        toast.success(`Sent ${data.sent} notification(s)!`, {
          description: `Found ${data.alerts_processed} due reminder(s)`,
        });
      } else {
        toast.info("No due reminders found", {
          description:
            "All caught up! Reminders will trigger at their scheduled time.",
        });
      }
    } catch (error) {
      toast.error("Failed to check due reminders", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsCheckingDue(false);
    }
  };

  // Not supported
  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${themeClasses.bgSurface}`}>
            <BellOff className={`w-6 h-6 ${themeClasses.textMuted}`} />
          </div>
          <div>
            <h4 className={`font-medium ${themeClasses.text}`}>
              Notifications Not Supported
            </h4>
            <p className={`text-sm ${themeClasses.textMuted}`}>
              Your browser doesn't support push notifications.
            </p>
          </div>
        </div>
        <div
          className={`p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border`}
        >
          <p className={`text-sm ${themeClasses.textMuted}`}>
            <strong>Tip:</strong> For the best experience, install this app on
            your home screen:
          </p>
          <ul
            className={`text-sm ${themeClasses.textMuted} mt-2 space-y-1 list-disc list-inside`}
          >
            <li>
              <strong>Android:</strong> Open in Chrome → Menu → "Add to Home
              screen"
            </li>
            <li>
              <strong>iOS 16.4+:</strong> Open in Safari → Share → "Add to Home
              Screen"
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permission === "denied") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/10">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h4 className={`font-medium ${themeClasses.text}`}>
              Notifications Blocked
            </h4>
            <p className={`text-sm ${themeClasses.textMuted}`}>
              You've blocked notifications for this app.
            </p>
          </div>
        </div>
        <div
          className={`p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border`}
        >
          <p className={`text-sm ${themeClasses.textMuted}`}>
            To enable notifications, you need to change your browser settings:
          </p>
          <ul
            className={`text-sm ${themeClasses.textMuted} mt-2 space-y-1 list-disc list-inside`}
          >
            <li>
              <strong>Chrome:</strong> Click the lock icon in the address bar →
              Site settings → Notifications → Allow
            </li>
            <li>
              <strong>Safari:</strong> Safari → Settings → Websites →
              Notifications → Allow for this site
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className={`w-8 h-8 animate-spin ${themeClasses.textMuted}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-3">
        <div
          className={`p-3 rounded-xl ${isSubscribed ? "bg-green-500/10" : themeClasses.bgSurface}`}
        >
          {isSubscribed ? (
            <BellRing className="w-6 h-6 text-green-400" />
          ) : (
            <Bell className={`w-6 h-6 ${themeClasses.textMuted}`} />
          )}
        </div>
        <div>
          <h4 className={`font-medium ${themeClasses.text}`}>
            Push Notifications
          </h4>
          <p
            className={`text-sm ${isSubscribed ? "text-green-400" : themeClasses.textMuted}`}
          >
            {isSubscribed
              ? "Enabled - You'll receive reminder alerts"
              : "Disabled - Enable to receive reminder alerts"}
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {!isSubscribed ? (
          <Button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Bell className="w-5 h-5 mr-2" />
            )}
            Enable Notifications
          </Button>
        ) : (
          <>
            <Button
              onClick={handleTestNotification}
              disabled={isSendingTest}
              variant="outline"
              className={`w-full ${themeClasses.border} border rounded-xl py-3`}
            >
              {isSendingTest ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <BellRing className="w-5 h-5 mr-2" />
              )}
              Send Test Notification
            </Button>
            <Button
              onClick={handleCheckDueReminders}
              disabled={isCheckingDue}
              variant="outline"
              className={`w-full ${themeClasses.border} border rounded-xl py-3`}
            >
              {isCheckingDue ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Clock className="w-5 h-5 mr-2" />
              )}
              Check Due Reminders Now
            </Button>
            <Button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              variant="ghost"
              className={`w-full ${themeClasses.textMuted} hover:text-red-400 rounded-xl py-3`}
            >
              <BellOff className="w-5 h-5 mr-2" />
              Disable Notifications
            </Button>
          </>
        )}
      </div>

      {/* Info */}
      <div
        className={`p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border`}
      >
        <h5 className={`font-medium ${themeClasses.text} mb-2`}>
          How it works
        </h5>
        <ul className={`text-sm ${themeClasses.textMuted} space-y-2`}>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>
              When you add a reminder with a time, you'll get an alarm-like
              notification
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Notifications stay on screen until you dismiss them</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>You can snooze reminders for 5 minutes</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Works even when the app is closed</span>
          </li>
        </ul>
      </div>

      {/* In-App Notification Preferences */}
      <InAppNotificationPreferences />
    </div>
  );
}

// Sub-component for in-app notification preferences
function InAppNotificationPreferences() {
  const themeClasses = useThemeClasses();
  const { data, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();

  const preferences = data?.preferences || [];

  const getPreference = (key: string) => {
    return preferences.find((p) => p.preference_key === key);
  };

  const getPreferenceValue = (key: string, defaultEnabled = true): boolean => {
    const pref = getPreference(key);
    return pref ? pref.enabled : defaultEnabled;
  };

  // Get preferred times array from metadata (for multiple reminders per day)
  const getPreferredTimes = (
    key: string,
    defaultTimes = ["18:00"]
  ): string[] => {
    const pref = getPreference(key);
    const metadata = pref?.metadata as Record<string, unknown> | null;
    if (metadata?.preferred_times && Array.isArray(metadata.preferred_times)) {
      // Convert "HH:mm:ss" to "HH:mm"
      return (metadata.preferred_times as string[]).map((t) =>
        t.substring(0, 5)
      );
    }
    // Fallback to old preferred_time field
    if (pref?.preferred_time) {
      return [pref.preferred_time.substring(0, 5)];
    }
    return defaultTimes;
  };

  const handleToggle = async (key: string, enabled: boolean) => {
    try {
      await updatePreference.mutateAsync({
        preference_key: key,
        enabled,
      });
      toast.success(enabled ? "Notification enabled" : "Notification disabled");
    } catch {
      toast.error("Failed to update preference");
    }
  };

  // Update a specific time slot (index) in the preferred_times array
  const handleTimeChange = async (
    key: string,
    time: string,
    index: number = 0
  ) => {
    const pref = getPreference(key);
    const currentMetadata = (pref?.metadata as Record<string, unknown>) || {};
    const currentTimes = getPreferredTimes(key);

    // Update the specific time slot
    const newTimes = [...currentTimes];
    newTimes[index] = time;

    // Convert to "HH:mm:ss" format for storage
    const timesWithSeconds = newTimes.map((t) =>
      t.length === 5 ? t + ":00" : t
    );

    try {
      await updatePreference.mutateAsync({
        preference_key: key,
        metadata: {
          ...currentMetadata,
          preferred_times: timesWithSeconds,
        },
      });
      toast.success(`Reminder time updated to ${formatTime(time)}`);
    } catch {
      toast.error("Failed to update reminder time");
    }
  };

  // Toggle between 1 and 2 reminder times per day
  const handleToggleSecondReminder = async (key: string, enable: boolean) => {
    const pref = getPreference(key);
    const currentMetadata = (pref?.metadata as Record<string, unknown>) || {};
    const currentTimes = getPreferredTimes(key);

    let newTimes: string[];
    if (enable) {
      // Add evening reminder (default 6 PM) if only morning exists
      newTimes =
        currentTimes.length === 1 ? [currentTimes[0], "18:00"] : currentTimes;
    } else {
      // Keep only the first time
      newTimes = [currentTimes[0]];
    }

    const timesWithSeconds = newTimes.map((t) =>
      t.length === 5 ? t + ":00" : t
    );

    try {
      await updatePreference.mutateAsync({
        preference_key: key,
        metadata: {
          ...currentMetadata,
          preferred_times: timesWithSeconds,
        },
      });
      toast.success(
        enable ? "Second reminder added" : "Second reminder removed"
      );
    } catch {
      toast.error("Failed to update reminders");
    }
  };

  // Format time for display (e.g., "18:00" -> "6:00 PM")
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className={`w-5 h-5 animate-spin ${themeClasses.textMuted}`} />
      </div>
    );
  }

  // Other notification types (excluding daily transaction reminder which has special UI)
  const notificationTypes = [
    {
      key: "weekly_summary",
      title: "Weekly Summary",
      description: "Get a summary of your spending each week",
      icon: MessageSquare,
      iconColor: "text-blue-400",
    },
    {
      key: "budget_warning",
      title: "Budget Alerts",
      description: "Alert me when I'm approaching or exceeding my budget",
      icon: Bell,
      iconColor: "text-orange-400",
    },
  ];

  // Preset times for morning and evening
  const morningPresetTimes = [
    { label: "7 AM", value: "07:00" },
    { label: "7:15 AM", value: "07:15" },
    { label: "8 AM", value: "08:00" },
    { label: "9 AM", value: "09:00" },
  ];

  const eveningPresetTimes = [
    { label: "5 PM", value: "17:00" },
    { label: "6 PM", value: "18:00" },
    { label: "7 PM", value: "19:00" },
    { label: "8 PM", value: "20:00" },
    { label: "9 PM", value: "21:00" },
  ];

  const isReminderEnabled = getPreferenceValue("daily_transaction_reminder");
  const currentReminderTimes = getPreferredTimes("daily_transaction_reminder", [
    "07:15",
    "18:00",
  ]);
  const hasTwoReminders = currentReminderTimes.length >= 2;

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex items-center gap-2">
        <MessageSquare className={`w-5 h-5 ${themeClasses.headerText}`} />
        <h4 className={`font-medium ${themeClasses.text}`}>
          In-App Notifications
        </h4>
      </div>
      <p className={`text-sm ${themeClasses.textMuted}`}>
        Customize which notifications appear in your notification center.
      </p>

      <div className="space-y-3">
        {/* Daily Transaction Reminder with Time Picker */}
        <div
          className={`p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5">
                <Pencil className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h5 className={`font-medium text-sm ${themeClasses.text}`}>
                  Daily Transaction Reminder
                </h5>
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  "Did you add all your transactions?"
                </p>
              </div>
            </div>
            <Switch
              checked={isReminderEnabled}
              onCheckedChange={(checked) =>
                handleToggle("daily_transaction_reminder", checked)
              }
              disabled={updatePreference.isPending}
            />
          </div>

          {/* Time picker - only show when enabled */}
          {isReminderEnabled && (
            <div className="ml-12 space-y-4">
              {/* Toggle for 2x daily reminders */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${themeClasses.textMuted}`} />
                  <span className={`text-sm ${themeClasses.textMuted}`}>
                    Remind me twice a day
                  </span>
                </div>
                <Switch
                  checked={hasTwoReminders}
                  onCheckedChange={(checked) =>
                    handleToggleSecondReminder(
                      "daily_transaction_reminder",
                      checked
                    )
                  }
                  disabled={updatePreference.isPending}
                />
              </div>

              {/* Morning reminder */}
              <div className="space-y-2">
                <span
                  className={`text-xs font-medium ${themeClasses.textMuted}`}
                >
                  ☀️ {hasTwoReminders ? "Morning" : "Daily"} Reminder
                </span>
                <div className="flex flex-wrap gap-2">
                  {(hasTwoReminders
                    ? morningPresetTimes
                    : [...morningPresetTimes, ...eveningPresetTimes]
                  ).map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() =>
                        handleTimeChange(
                          "daily_transaction_reminder",
                          preset.value,
                          0
                        )
                      }
                      disabled={updatePreference.isPending}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        currentReminderTimes[0] === preset.value
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                          : `${themeClasses.bgSurface} ${themeClasses.textMuted} hover:bg-white/10`
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${themeClasses.textMuted}`}>
                    Custom:
                  </span>
                  <input
                    type="time"
                    value={currentReminderTimes[0] || "07:15"}
                    onChange={(e) =>
                      handleTimeChange(
                        "daily_transaction_reminder",
                        e.target.value,
                        0
                      )
                    }
                    disabled={updatePreference.isPending}
                    className={`px-3 py-1.5 rounded-lg text-sm ${themeClasses.bgSurface} ${themeClasses.text} ${themeClasses.border} border focus:outline-none focus:ring-2 focus:ring-cyan-500/50`}
                  />
                </div>
              </div>

              {/* Evening reminder (only shown when 2x daily is enabled) */}
              {hasTwoReminders && (
                <div className="space-y-2">
                  <span
                    className={`text-xs font-medium ${themeClasses.textMuted}`}
                  >
                    🌙 Evening Reminder
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {eveningPresetTimes.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() =>
                          handleTimeChange(
                            "daily_transaction_reminder",
                            preset.value,
                            1
                          )
                        }
                        disabled={updatePreference.isPending}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentReminderTimes[1] === preset.value
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                            : `${themeClasses.bgSurface} ${themeClasses.textMuted} hover:bg-white/10`
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${themeClasses.textMuted}`}>
                      Custom:
                    </span>
                    <input
                      type="time"
                      value={currentReminderTimes[1] || "18:00"}
                      onChange={(e) =>
                        handleTimeChange(
                          "daily_transaction_reminder",
                          e.target.value,
                          1
                        )
                      }
                      disabled={updatePreference.isPending}
                      className={`px-3 py-1.5 rounded-lg text-sm ${themeClasses.bgSurface} ${themeClasses.text} ${themeClasses.border} border focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                    />
                  </div>
                </div>
              )}

              <p className={`text-xs ${themeClasses.textMuted} italic`}>
                Times are in your local timezone
              </p>
            </div>
          )}
        </div>

        {/* Other notification types */}
        {notificationTypes.map((type) => {
          const Icon = type.icon;
          const isEnabled = getPreferenceValue(type.key);

          return (
            <div
              key={type.key}
              className={`flex items-center justify-between p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5`}>
                  <Icon className={`w-5 h-5 ${type.iconColor}`} />
                </div>
                <div>
                  <h5 className={`font-medium text-sm ${themeClasses.text}`}>
                    {type.title}
                  </h5>
                  <p className={`text-xs ${themeClasses.textMuted}`}>
                    {type.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(type.key, checked)}
                disabled={updatePreference.isPending}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
