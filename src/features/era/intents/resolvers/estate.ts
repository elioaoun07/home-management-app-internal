// src/features/era/intents/resolvers/estate.ts
// HUB-81 — estate reads (answers only, no writes) over existing routes:
//   activity.read → GET /api/activity-log (household RPC; honest when the
//                   owner migration isn't applied yet — 503 SETUP_REQUIRED)
//   purchases.read → GET /api/future-purchases (own rows)
// Trips, Healthcare and Catalogue reads wait on TRIP-1–3, HLTH-25, HUB-69.

import { safeFetch } from "@/lib/safeFetch";
import { moneyIn } from "../formatters/budget";

interface Result {
  text: string;
  metadata?: Record<string, unknown>;
  ok?: boolean;
}

export async function resolveActivityRead(
  actor: "me" | "partner" | undefined,
  window: "today" | "recent",
): Promise<Result> {
  const params = new URLSearchParams({ limit: "5" });
  if (actor) params.set("actor", actor);
  if (window === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    params.set("from", start.toISOString());
  }
  try {
    const res = await safeFetch(`/api/activity-log?${params.toString()}`, { timeoutMs: 8_000 });
    if (res.status === 503) return { text: "Activity log isn't on yet.", ok: false };
    if (!res.ok) return { text: "Couldn't read activity.", ok: false };
    const page = (await res.json()) as {
      events?: Array<{ title: string; actor_name: string; occurred_at: string; available: boolean }>;
    };
    const events = (page.events ?? []).filter((e) => e.available);
    if (events.length === 0) return { text: window === "today" ? "Nothing today." : "Nothing recent.", metadata: { count: 0 } };
    const lines = events.map(
      (e) =>
        `${e.actor_name} · ${e.title} · ${new Date(e.occurred_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    );
    return { text: lines.join("\n"), metadata: { count: events.length } };
  } catch {
    return { text: "Couldn't read activity.", ok: false };
  }
}

export async function resolveFuturePurchases(): Promise<Result> {
  try {
    const res = await safeFetch("/api/future-purchases?status=active", { timeoutMs: 8_000 });
    if (!res.ok) return { text: "Couldn't read future purchases.", ok: false };
    const rows = (await res.json()) as Array<{ name: string; target_amount: number; current_saved: number; target_date: string }>;
    if (!Array.isArray(rows) || rows.length === 0) return { text: "Nothing planned.", metadata: { count: 0 } };
    const lines = rows
      .slice(0, 3)
      .map((p) => `${p.name} · ${moneyIn(Number(p.current_saved))} of ${moneyIn(Number(p.target_amount))}`);
    return { text: lines.join("\n"), metadata: { count: rows.length } };
  } catch {
    return { text: "Couldn't read future purchases.", ok: false };
  }
}
