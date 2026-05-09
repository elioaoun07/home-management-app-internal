"use client";

// ERA Schedule Dashboard — overdue, today, tomorrow, this week timeline.
// Pulls from items + reminder_details + event_details + item_alerts via the
// shared scheduleTime helper so it matches the hub Schedule card.

import {
  bucketSchedule,
  getEffectiveSchedule,
  type ScheduleSourceRow,
} from "@/lib/items/scheduleTime";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EraStatCard } from "./EraStatCard";

const HUE = 256;
const ACCENT = `hsl(${HUE}, 72%, 68%)`;

type ItemSource = "event" | "reminder" | "alert";

interface ScheduleItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  scheduledAt: string | null;
  source: ItemSource;
  bucket: "overdue" | "today" | "tomorrow" | "thisWeek";
  itemType: string;
  allDay: boolean;
}

interface RawRow {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string | null;
  responsible_user_id: string;
  reminder_details:
    | { due_at: string | null; completed_at: string | null }
    | Array<{ due_at: string | null; completed_at: string | null }>
    | null;
  event_details:
    | {
        start_at: string | null;
        end_at: string | null;
        all_day: boolean | null;
      }
    | Array<{
        start_at: string | null;
        end_at: string | null;
        all_day: boolean | null;
      }>
    | null;
  item_alerts: Array<{ trigger_at: string | null; active: boolean }> | null;
}

const SELECT = `
  id, title, status, type, priority,
  reminder_details (*),
  event_details (*),
  item_alerts (*)
`;

interface ScheduleDashData {
  items: ScheduleItem[];
  completedTodayCount: number;
}

async function fetchScheduleData(): Promise<ScheduleDashData> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], completedTodayCount: 0 };

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

  let q = supabase
    .from("items")
    .select(SELECT)
    .is("archived_at", null)
    .not("status", "in", `("completed","cancelled")`)
    .limit(300);

  q = partnerId
    ? q.or(`user_id.eq.${user.id},user_id.eq.${partnerId}`)
    : q.eq("user_id", user.id);

  const { data: rows } = await q;
  if (!rows) return { items: [], completedTodayCount: 0 };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const items: ScheduleItem[] = [];
  let completedTodayCount = 0;

  for (const row of rows as unknown as RawRow[]) {
    const reminder = Array.isArray(row.reminder_details)
      ? row.reminder_details[0]
      : row.reminder_details;
    if (reminder?.completed_at) {
      const at = new Date(reminder.completed_at);
      if (at >= todayStart && at <= todayEnd) completedTodayCount++;
      continue;
    }

    const sched = getEffectiveSchedule(row as ScheduleSourceRow);
    if (!sched.scheduledAt) continue;

    const bucket = bucketSchedule(sched.scheduledAt, now);
    if (
      bucket !== "overdue" &&
      bucket !== "today" &&
      bucket !== "tomorrow" &&
      bucket !== "thisWeek"
    ) {
      continue;
    }

    items.push({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      scheduledAt: sched.scheduledAt,
      source: sched.source === "none" ? "alert" : sched.source,
      bucket,
      itemType: row.type,
      allDay: sched.allDay,
    });
  }

  items.sort((a, b) => {
    const order: Record<ScheduleItem["bucket"], number> = {
      overdue: 0,
      today: 1,
      tomorrow: 2,
      thisWeek: 3,
    };
    if (order[a.bucket] !== order[b.bucket])
      return order[a.bucket] - order[b.bucket];
    return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  });

  return { items, completedTodayCount };
}

function useScheduleData() {
  return useQuery<ScheduleDashData>({
    queryKey: ["era", "dashboard", "schedule"],
    queryFn: fetchScheduleData,
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}

function formatTime(iso: string | null, allDay: boolean): string {
  if (!iso) return "—";
  if (allDay) return "All day";
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

const PRIORITY_TONE: Record<string, { bg: string; fg: string }> = {
  urgent: { bg: "hsla(0, 70%, 50%, 0.18)", fg: "hsl(0, 80%, 75%)" },
  high: { bg: "hsla(28, 70%, 50%, 0.18)", fg: "hsl(28, 80%, 72%)" },
  normal: { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.55)" },
  low: { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.35)" },
};

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority || priority === "normal") return null;
  const tone = PRIORITY_TONE[priority] ?? PRIORITY_TONE.normal;
  return (
    <span
      className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {priority}
    </span>
  );
}

function TypeIcon({ type }: { type: string }) {
  const ch =
    type === "event"
      ? "◆"
      : type === "reminder"
        ? "●"
        : type === "task"
          ? "▣"
          : "•";
  return (
    <span
      className="shrink-0 text-[10px]"
      style={{ color: "rgba(255,255,255,0.4)" }}
      aria-hidden
    >
      {ch}
    </span>
  );
}

function ItemRow({
  item,
  danger = false,
}: {
  item: ScheduleItem;
  danger?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: danger
          ? `hsla(0, 55%, 18%, 0.5)`
          : `hsla(${HUE}, 25%, 10%, 0.6)`,
        border: danger
          ? `1px solid hsla(0, 55%, 40%, 0.2)`
          : `1px solid hsla(${HUE}, 55%, 45%, 0.15)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: danger ? "hsl(0, 70%, 65%)" : ACCENT,
          boxShadow: danger ? "0 0 6px hsl(0, 70%, 60%)" : `0 0 6px ${ACCENT}`,
        }}
      />
      <TypeIcon type={item.itemType} />
      <span className="flex-1 truncate text-sm text-white/75">
        {item.title}
      </span>
      <PriorityBadge priority={item.priority} />
      <span
        className="shrink-0 text-[10px]"
        style={{
          color: danger
            ? "hsla(0, 70%, 70%, 0.65)"
            : `hsla(${HUE}, 60%, 65%, 0.55)`,
        }}
      >
        {danger ? "Overdue" : formatTime(item.scheduledAt, item.allDay)}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
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
        {title}
      </p>
      {children}
    </div>
  );
}

export function ScheduleDashboard() {
  const { data, isLoading } = useScheduleData();
  const items = data?.items ?? [];
  const completedTodayCount = data?.completedTodayCount ?? 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const overdue = useMemo(
    () => items.filter((i) => i.bucket === "overdue"),
    [items],
  );
  const today = useMemo(
    () => items.filter((i) => i.bucket === "today"),
    [items],
  );
  const tomorrow = useMemo(
    () => items.filter((i) => i.bucket === "tomorrow"),
    [items],
  );
  const thisWeek = useMemo(
    () => items.filter((i) => i.bucket === "thisWeek"),
    [items],
  );

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <EraStatCard
          hue={HUE}
          label="Due today"
          value={isLoading ? "…" : today.length}
          sub="items"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Overdue"
          value={isLoading ? "…" : overdue.length}
          sub={overdue.length > 0 ? "needs attention" : "all clear"}
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="This week"
          value={isLoading ? "…" : tomorrow.length + thisWeek.length}
          sub="upcoming"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Completed today"
          value={isLoading ? "…" : completedTodayCount}
          sub="finished"
          loading={isLoading}
        />
      </div>

      {/* Today's timeline */}
      <Section title="Today's schedule">
        {isLoading || !mounted ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl bg-white/5"
              />
            ))}
          </div>
        ) : overdue.length === 0 && today.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">
            Clear today — nothing due.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {overdue.map((item) => (
              <ItemRow key={item.id} item={item} danger />
            ))}
            {today.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </Section>

      {/* Tomorrow */}
      {mounted && tomorrow.length > 0 && (
        <Section title="Tomorrow">
          <div className="flex flex-col gap-2">
            {tomorrow.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </Section>
      )}

      {/* Coming up */}
      {mounted && thisWeek.length > 0 && (
        <Section title="Coming up">
          <ul className="flex flex-col gap-2">
            {thisWeek.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="h-1 w-1 shrink-0 rounded-full bg-white/25" />
                <TypeIcon type={item.itemType} />
                <span className="flex-1 truncate text-sm text-white/55">
                  {item.title}
                </span>
                <PriorityBadge priority={item.priority} />
                <span className="shrink-0 text-[10px] text-white/30">
                  {formatDate(item.scheduledAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
