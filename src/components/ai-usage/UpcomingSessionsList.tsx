"use client";

import { sessionsThatFit } from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { UpcomingAISession } from "@/types/aiUsage";

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function formatWhen(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingSessionsList({
  sessions,
  remainingPct,
}: {
  sessions: UpcomingAISession[];
  remainingPct: number;
}) {
  const tc = useThemeClasses();

  // Bucket by session_type to say "N Application sessions fit in your
  // remaining X%".
  const buckets = new Map<
    string,
    { name: string; weight: number; count: number }
  >();
  for (const s of sessions) {
    const key = s.session_type_id;
    const b = buckets.get(key) ?? {
      name: s.session_type_name,
      weight: s.estimated_usage_pct,
      count: 0,
    };
    b.count += 1;
    buckets.set(key, b);
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {sessions.map((s) => (
          <li
            key={s.item_id + ":" + s.session_type_id}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 border ${tc.border}`}
          >
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${tc.textHighlight} truncate`}>
                {s.item_title}
              </div>
              <div className={`text-[11px] ${tc.textFaint}`}>
                {formatWhen(s.when_at)} · {s.session_type_name}
              </div>
            </div>
            <div className={`text-xs ${tc.textMuted}`}>
              {fmt(s.estimated_usage_pct)}%
            </div>
          </li>
        ))}
      </ul>

      {buckets.size > 0 && (
        <div className={`text-[11px] ${tc.textFaint} space-y-0.5 pt-1`}>
          {Array.from(buckets.values()).map((b) => {
            const fit = sessionsThatFit(remainingPct, b.weight);
            const fitLabel = !Number.isFinite(fit) ? "∞" : fit;
            return (
              <div key={b.name}>
                Budget fits <span className={tc.textMuted}>{fitLabel}</span>{" "}
                more <span className={tc.textMuted}>{b.name}</span> session
                {b.count === 1 ? "" : "s"} (you have {b.count} planned).
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
