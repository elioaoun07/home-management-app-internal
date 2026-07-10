// src/components/settings/GoogleCalendarSettings.tsx
// One-way (app -> Google) Google Calendar backup sync toggle. Parallel to
// push notifications, never a replacement — see /api/gcal/* routes and
// src/lib/gcal/sync.ts. Only Scheduled items (Reminders/Events) sync;
// System alerts never do.

"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { safeFetch } from "@/lib/safeFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const gcalKeys = {
  all: ["gcal"] as const,
  connection: () => [...gcalKeys.all, "connection"] as const,
};

interface GoogleCalendarConnection {
  sync_enabled: boolean;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
}

function useGoogleCalendarConnection() {
  return useQuery({
    queryKey: gcalKeys.connection(),
    queryFn: async () => {
      const res = await fetch("/api/gcal/connection");
      if (!res.ok) throw new Error("Failed to fetch connection status");
      const data = await res.json();
      return data.connection as GoogleCalendarConnection | null;
    },
    staleTime: 60000,
  });
}

export function GoogleCalendarSettings() {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useGoogleCalendarConnection();
  const searchParams = useSearchParams();

  // Reflect the redirect result from /api/gcal/callback.
  useEffect(() => {
    const status = searchParams.get("gcal");
    if (!status) return;
    if (status === "connected") {
      toast.success("Google Calendar connected", {
        description: "Your reminders and events will now sync as a backup.",
      });
    } else if (status === "error") {
      toast.error("Google Calendar connection failed", {
        description: searchParams.get("gcal_message") || "Please try again.",
      });
    }
    queryClient.invalidateQueries({ queryKey: gcalKeys.connection() });
    // Clean the query params so a refresh doesn't re-toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("gcal");
    url.searchParams.delete("gcal_message");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleToggle = async (enabled: boolean) => {
    const res = await safeFetch("/api/gcal/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sync_enabled: enabled }),
    });
    if (!res.ok) {
      toast.error("Failed to update sync setting");
      return;
    }
    queryClient.invalidateQueries({ queryKey: gcalKeys.connection() });
    toast.success(enabled ? "Calendar sync resumed" : "Calendar sync paused");
  };

  const handleDisconnect = async () => {
    const res = await safeFetch("/api/gcal/connection", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to disconnect");
      return;
    }
    queryClient.invalidateQueries({ queryKey: gcalKeys.connection() });
    toast.success("Google Calendar disconnected");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className={`w-5 h-5 animate-spin ${themeClasses.textMuted}`} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex items-center gap-2">
        <CalendarDays className={`w-5 h-5 ${themeClasses.headerText}`} />
        <h4 className={`font-medium ${themeClasses.text}`}>
          Google Calendar Backup Sync
        </h4>
      </div>
      <p className={`text-sm ${themeClasses.textMuted}`}>
        One-way backup: your Reminders and Events are pushed to a dedicated
        "ERA" calendar in Google, so Google's own app can alert you even if a
        push notification is delayed or you're offline. System alerts (daily
        summaries, budget nudges) never sync. Editing events in Google has no
        effect here — this app is always the source.
      </p>

      {!connection ? (
        <Button asChild className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 rounded-xl">
          <a href="/api/gcal/connect">
            <CalendarDays className="w-5 h-5 mr-2" />
            Connect Google Calendar
          </a>
        </Button>
      ) : (
        <div
          className={`p-4 rounded-xl ${themeClasses.bgSurface} ${themeClasses.border} border space-y-3`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5">
                {connection.sync_error ? (
                  <XCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
              </div>
              <div>
                <h5 className={`font-medium text-sm ${themeClasses.text}`}>
                  {connection.sync_enabled ? "Syncing" : "Paused"}
                </h5>
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  {connection.last_synced_at
                    ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                    : "Not synced yet"}
                </p>
              </div>
            </div>
            <Switch
              checked={connection.sync_enabled}
              onCheckedChange={handleToggle}
            />
          </div>

          {connection.sync_error && (
            <p className="text-xs text-red-400">{connection.sync_error}</p>
          )}

          <Button
            onClick={handleDisconnect}
            variant="ghost"
            className={`w-full ${themeClasses.textMuted} hover:text-red-400 rounded-xl`}
          >
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
