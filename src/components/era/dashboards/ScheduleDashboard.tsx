"use client";

// ERA Schedule Dashboard — today's items timeline, upcoming list, overdue alerts.

import { eraKeys } from "@/features/era/queryKeys";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EraStatCard } from "./EraStatCard";

const HUE = 256;
const ACCENT = `hsl(${HUE}, 72%, 68%)`;

interface ScheduleItem {
  id: string;
  title: string;
  status: string;
  trigger_at: string | null;
  isOverdue: boolean;
  isToday: boolean;
}

async function fetchScheduleData(): Promise<ScheduleItem[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  const partnerId = link
    ? link.owner_user_id === user.id
      ? link.partner_user_id
      : link.owner_user_id
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  let q = supabase
    .from("items")
    .select("id, title, status, item_alerts(trigger_at, active)")
    .not("status", "in", `("completed","cancelled","dormant")`)
    .limit(100);

  if (partnerId) {
    q = q.in("responsible_user_id", [user.id, partnerId]);
  } else {
    q = q.eq("responsible_user_id", user.id);
  }

  const { data: rows } = await q;
  if (!rows) return [];

  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const items: ScheduleItem[] = [];
  for (const row of rows) {
    const alerts = (
      row as {
        item_alerts: Array<{
          trigger_at: string | null;
          active: boolean;
        }> | null;
      }
    ).item_alerts;
    const alert = alerts?.find((a) => a.active && a.trigger_at);
    const trigger_at = alert?.trigger_at ?? null;
    const at = trigger_at ? new Date(trigger_at) : null;
    const isOverdue = at ? at < todayStart : false;
    const isToday = at ? at >= todayStart && at <= todayEnd : false;
    const isUpcoming = at ? at > todayEnd && at <= weekEnd : false;
    if (isOverdue || isToday || isUpcoming) {
      items.push({
        id: row.id,
        title: row.title,
        status: row.status,
        trigger_at,
        isOverdue,
        isToday,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return (a.trigger_at ?? "").localeCompare(b.trigger_at ?? "");
  });
}

function useScheduleData() {
  return useQuery<ScheduleItem[]>({
    queryKey: ["era", "dashboard", "schedule"],
    queryFn: async () => {
      const result = await fetchScheduleData();
      return Array.isArray(result) ? result : [];
    },
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ScheduleDashboard() {
  const { data: rawItems, isLoading } = useScheduleData();
  const items: ScheduleItem[] = Array.isArray(rawItems) ? rawItems : [];
  // Gate date-sensitive rendering to client only to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const todayItems = items.filter((i) => i.isToday);
  const overdueItems = items.filter((i) => i.isOverdue);
  const upcomingItems = items.filter((i) => !i.isToday && !i.isOverdue);

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <EraStatCard
          hue={HUE}
          label="Due today"
          value={isLoading ? "…" : todayItems.length}
          sub="items"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Overdue"
          value={isLoading ? "…" : overdueItems.length}
          sub={overdueItems.length > 0 ? "needs attention" : "all clear"}
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="This week"
          value={isLoading ? "…" : upcomingItems.length}
          sub="upcoming"
          loading={isLoading}
        />
      </div>

      {/* Today's timeline */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: `hsla(${HUE}, 18%, 7%, 0.82)`,
          border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
          backdropFilter: "blur(14px)",
        }}
      >
        <p
          className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
          style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
        >
          Today's schedule
        </p>

        {isLoading || !mounted ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl bg-white/5"
              />
            ))}
          </div>
        ) : overdueItems.length === 0 && todayItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">
            Clear today — nothing due.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {overdueItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: `hsla(0, 55%, 18%, 0.5)`,
                  border: `1px solid hsla(0, 55%, 40%, 0.2)`,
                }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/70" />
                <span className="flex-1 text-sm text-white/70">
                  {item.title}
                </span>
                <span className="shrink-0 text-[10px] text-rose-400/60">
                  Overdue
                </span>
              </div>
            ))}
            {todayItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: `hsla(${HUE}, 25%, 10%, 0.6)`,
                  border: `1px solid hsla(${HUE}, 55%, 45%, 0.15)`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
                />
                <span className="flex-1 text-sm text-white/75">
                  {item.title}
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: `hsla(${HUE}, 60%, 65%, 0.5)` }}
                >
                  {formatTime(item.trigger_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingItems.length > 0 && mounted && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            Coming up
          </p>
          <ul className="flex flex-col gap-2">
            {upcomingItems.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="h-1 w-1 shrink-0 rounded-full bg-white/25" />
                <span className="flex-1 text-sm text-white/55">
                  {item.title}
                </span>
                <span className="shrink-0 text-[10px] text-white/30">
                  {formatDate(item.trigger_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
