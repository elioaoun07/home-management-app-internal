"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useActivityLog } from "@/features/activity-log/hooks";
import {
  ACTIVITY_MODULES,
  activitySourceHref,
  type ActivityEvent,
  type ActivityFilters,
  type ActivityModule,
} from "@/features/activity-log/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { localToISO } from "@/lib/utils/date";
import { addDays, format, subDays } from "date-fns";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Download,
  HeartPulse,
  Home,
  Info,
  Layers,
  MessageCircle,
  Plane,
  RefreshCw,
  Settings,
  Shirt,
  Sparkles,
  Utensils,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const MODULE_ICONS = {
  budget: Wallet,
  schedule: CalendarDays,
  chat: MessageCircle,
  kitchen: Utensils,
  catalogue: Layers,
  trips: Plane,
  healthcare: HeartPulse,
  outfits: Shirt,
  guests: Home,
  era: Sparkles,
  notifications: Bell,
  settings: Settings,
};
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function words(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default function ActivityLogClient({ userId }: { userId: string }) {
  const tc = useThemeClasses();
  const { theme } = useTheme();
  const [module, setModule] = useState<ActivityModule | "">("");
  const [feature, setFeature] = useState("");
  const [actor, setActor] = useState<ActivityFilters["actor"]>();
  const [from, setFrom] = useState(() =>
    format(subDays(new Date(), 6), "yyyy-MM-dd"),
  );
  const [through, setThrough] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [help, setHelp] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const invalidDates = !!(from && through && from > through);
  const filters = useMemo<ActivityFilters>(
    () => ({
      module: module || undefined,
      feature: feature || undefined,
      actor,
      from: from ? localToISO(from, "00:00") : undefined,
      until: through
        ? localToISO(
            format(addDays(new Date(`${through}T12:00:00`), 1), "yyyy-MM-dd"),
            "00:00",
          )
        : undefined,
    }),
    [module, feature, actor, from, through],
  );
  const activity = useActivityLog(userId, filters);
  const firstPage = activity.data?.pages[0];
  // Hide the previous response on authorization/connectivity failures. A stale
  // private title must not masquerade as currently authorized offline history.
  const events =
    activity.authorized && !activity.isError && !invalidDates
      ? (activity.data?.pages.flatMap((page) => page.events) ?? [])
      : [];
  const features = [
    ...new Set(
      (firstPage?.sources ?? [])
        .filter((source) => !module || source.module === module)
        .map((source) => source.feature),
    ),
  ].sort();
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const day = format(new Date(event.occurred_at), "EEE, d MMM yyyy");
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const control = cn(
    "h-11 min-w-0 rounded-xl border px-3 text-sm outline-none focus:ring-2",
    tc.bgPage,
    tc.border,
    tc.labelText,
    tc.focusRing,
  );
  const iconButton = cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
    tc.border,
    tc.bgHover,
    tc.text,
  );

  return (
    <main className={cn("min-h-dvh pb-10", tc.bgPage, tc.labelText)}>
      <header
        className={cn(
          "sticky top-0 z-30 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
          tc.bgPage,
          tc.border,
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/era" aria-label="ERA home" className={iconButton}>
            <Home size={18} />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Activity className={cn("h-6 w-6 shrink-0", tc.text)} />
            <h1 className="truncate text-xl font-semibold">Activity</h1>
          </div>
          {installPrompt && (
            <button
              type="button"
              className={iconButton}
              aria-label="Install Activity"
              onClick={async () => {
                try {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                } catch {
                  setHelp(true);
                } finally {
                  setInstallPrompt(null);
                }
              }}
            >
              <Download size={18} />
            </button>
          )}
          <button
            type="button"
            className={iconButton}
            aria-label="Activity information"
            aria-expanded={help}
            onClick={() => setHelp(!help)}
          >
            <Info size={18} />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="Refresh activity"
            disabled={activity.isFetching}
            onClick={() => void activity.refetch()}
          >
            <RefreshCw
              size={18}
              className={activity.isFetching ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        {help && (
          <div
            className={cn(
              "space-y-2 rounded-2xl border p-4 text-sm",
              tc.border,
              tc.textMuted,
            )}
          >
            <p>Browser menu → Add to Home Screen</p>
            <p>Visible records only · updates every 15 seconds</p>
            <p>
              {firstPage?.recording_since
                ? `First recorded activity: ${format(new Date(firstPage.recording_since), "d MMM yyyy")}`
                : "History starts when recording is enabled"}
            </p>
            {firstPage && (
              <p>{firstPage.sources.length} active activity sources</p>
            )}
          </div>
        )}

        <section aria-label="Activity filters" className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label
              className={cn(
                "flex min-w-0 flex-col gap-1.5 text-xs",
                tc.textMuted,
              )}
            >
              Module
              <select
                aria-label="Module"
                value={module}
                className={control}
                onChange={(event) => {
                  setModule(event.target.value as ActivityModule | "");
                  setFeature("");
                }}
              >
                <option value="">All modules</option>
                {Object.entries(ACTIVITY_MODULES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label
              className={cn(
                "flex min-w-0 flex-col gap-1.5 text-xs",
                tc.textMuted,
              )}
            >
              Feature
              <select
                aria-label="Feature"
                value={feature}
                className={control}
                onChange={(event) => setFeature(event.target.value)}
              >
                <option value="">All features</option>
                {features.map((value) => (
                  <option key={value} value={value}>
                    {words(value)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className={cn(
                "col-span-2 flex min-w-0 flex-col gap-1.5 text-xs sm:col-span-1",
                tc.textMuted,
              )}
            >
              Person
              <select
                aria-label="Person"
                value={actor ?? ""}
                className={control}
                onChange={(event) =>
                  setActor(
                    (event.target.value ||
                      undefined) as ActivityFilters["actor"],
                  )
                }
              >
                <option value="">Everyone</option>
                <option value="me">You</option>
                <option value="partner">Partner</option>
                <option value="system">System / external</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={cn(
                "flex min-w-0 flex-col gap-1.5 text-xs",
                tc.textMuted,
              )}
            >
              From
              <input
                type="date"
                aria-label="From date"
                className={cn(control, "w-full")}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label
              className={cn(
                "flex min-w-0 flex-col gap-1.5 text-xs",
                tc.textMuted,
              )}
            >
              Through
              <input
                type="date"
                aria-label="Through date"
                className={cn(control, "w-full")}
                value={through}
                onChange={(event) => setThrough(event.target.value)}
              />
            </label>
          </div>
        </section>

        {!activity.authorized ? (
          <p role="status" className="py-10 text-center">
            <Link href="/login?redirect=%2Factivity-log" className={tc.text}>
              Sign in to view activity
            </Link>
          </p>
        ) : invalidDates ? (
          <p role="alert" className={tc.textMuted}>
            Check the date range
          </p>
        ) : activity.isError ? (
          <div
            role="alert"
            className={cn("rounded-2xl border p-6 text-center", tc.border)}
          >
            <p>{activity.error.message}</p>
            <button
              type="button"
              onClick={() => void activity.refetch()}
              className={cn(
                "mt-3 min-h-11 rounded-xl border px-5",
                tc.border,
                tc.text,
              )}
            >
              Retry
            </button>
          </div>
        ) : activity.isPending ? (
          <p role="status" className={cn("py-12 text-center", tc.textMuted)}>
            Loading activity…
          </p>
        ) : events.length === 0 ? (
          <div className={cn("rounded-2xl border p-10 text-center", tc.border)}>
            <Activity className={cn("mx-auto mb-3 h-8 w-8", tc.textMuted)} />
            <p>No activity in this range</p>
          </div>
        ) : (
          <div className="space-y-6" aria-label="Activity timeline">
            {[...groups].map(([day, rows]) => (
              <section key={day}>
                <h2
                  className={cn(
                    "mb-3 text-xs font-semibold uppercase tracking-wider",
                    tc.textMuted,
                  )}
                >
                  {day}
                </h2>
                <div
                  className={cn(
                    "divide-y overflow-hidden rounded-2xl border",
                    tc.border,
                  )}
                >
                  {rows.map((event) => {
                    const Icon = MODULE_ICONS[event.module] ?? Activity;
                    const expanded = selectedId === event.id;
                    const href = activitySourceHref(event);
                    const personColor = !event.actor_id
                      ? tc.textMuted
                      : (
                            event.actor_id === userId
                              ? theme === "pink"
                              : theme !== "pink"
                          )
                        ? "text-pink-400"
                        : "text-blue-400";
                    return (
                      <article
                        key={event.id}
                        className={cn("border-inherit", tc.bgSurface)}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 p-4 text-left"
                          aria-expanded={expanded}
                          onClick={() =>
                            setSelectedId(expanded ? null : event.id)
                          }
                        >
                          <span
                            className={cn(
                              "mt-1 rounded-xl border p-2.5",
                              tc.border,
                              tc.text,
                            )}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className={cn("block text-xs", personColor)}>
                              {event.actor_name} · {words(event.action)}
                            </span>
                            <span className="block truncate text-sm font-medium">
                              {event.title}
                            </span>
                            <span className={cn("block text-xs", tc.textMuted)}>
                              {ACTIVITY_MODULES[event.module]} ·{" "}
                              {words(event.feature)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "flex shrink-0 flex-col items-end gap-2 text-xs",
                              tc.textMuted,
                            )}
                          >
                            <time dateTime={event.occurred_at}>
                              {format(new Date(event.occurred_at), "HH:mm")}
                            </time>
                            <ChevronDown
                              size={15}
                              className={expanded ? "rotate-180" : ""}
                            />
                          </span>
                        </button>
                        {expanded && (
                          <div
                            className={cn(
                              "space-y-2 px-4 pb-4 pl-[4.5rem] text-xs",
                              tc.textMuted,
                            )}
                          >
                            <p>
                              {format(
                                new Date(event.occurred_at),
                                "d MMM yyyy · HH:mm:ss",
                              )}
                            </p>
                            {event.changed_fields.length > 0 && (
                              <p className="break-words">
                                {event.changed_fields.map(words).join(" · ")}
                              </p>
                            )}
                            {href && (
                              <Link
                                href={href}
                                className={cn(
                                  "inline-flex min-h-11 items-center gap-1 text-sm font-medium",
                                  tc.text,
                                )}
                              >
                                Open <ArrowUpRight size={15} />
                              </Link>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            {activity.hasNextPage && (
              <button
                type="button"
                className={cn(
                  "h-11 w-full rounded-xl border text-sm",
                  tc.border,
                  tc.text,
                )}
                disabled={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {activity.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
