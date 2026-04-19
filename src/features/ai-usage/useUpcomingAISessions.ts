// src/features/ai-usage/useUpcomingAISessions.ts
// Reads items whose metadata_json.ai_usage = { model_id, session_type_id }
// and resolves them against the user's session-type templates so the
// AI Usage page can show upcoming consumption forecasts.

"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  AISessionType,
  AIUsageModel,
  UpcomingAISession,
} from "@/types/aiUsage";
import { useQuery } from "@tanstack/react-query";
import { aiUsageKeys } from "./queryKeys";

interface RawItemRow {
  id: string;
  user_id: string;
  title: string;
  type: "reminder" | "event" | "task";
  metadata_json: Record<string, unknown> | null;
  reminder_details: { due_at: string | null }[] | null;
  event_details: { start_at: string | null }[] | null;
}

function readAIUsageLink(
  row: RawItemRow,
): { model_id: string; session_type_id: string } | null {
  const md = row.metadata_json;
  if (!md || typeof md !== "object") return null;
  const link = (md as { ai_usage?: unknown }).ai_usage;
  if (!link || typeof link !== "object") return null;
  const m = (link as { model_id?: unknown }).model_id;
  const s = (link as { session_type_id?: unknown }).session_type_id;
  if (typeof m !== "string" || typeof s !== "string") return null;
  return { model_id: m, session_type_id: s };
}

function itemWhen(row: RawItemRow): string | null {
  if (row.type === "event") return row.event_details?.[0]?.start_at ?? null;
  if (row.type === "reminder") return row.reminder_details?.[0]?.due_at ?? null;
  return null;
}

async function fetchUpcomingAISessions(): Promise<UpcomingAISession[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Get all non-archived items that have metadata_json.ai_usage set.
  //    Postgres jsonb `?` operator works via the contains filter.
  const { data: items, error } = await supabase
    .from("items")
    .select(
      `
      id,
      user_id,
      title,
      type,
      metadata_json,
      reminder_details ( due_at ),
      event_details ( start_at )
    `,
    )
    .eq("user_id", user.id)
    .is("archived_at", null)
    .not("metadata_json->ai_usage", "is", null);

  if (error) {
    console.error("Error fetching AI-tagged items:", error);
    return [];
  }

  const rows = (items ?? []) as unknown as RawItemRow[];

  // 2. Load session types for all referenced models so we can resolve weights.
  //    (Small table, one batch request.)
  const typeIds = new Set<string>();
  const modelIds = new Set<string>();
  const parsed = rows
    .map((r) => {
      const link = readAIUsageLink(r);
      if (!link) return null;
      typeIds.add(link.session_type_id);
      modelIds.add(link.model_id);
      return { row: r, link };
    })
    .filter(
      (
        x,
      ): x is {
        row: RawItemRow;
        link: { model_id: string; session_type_id: string };
      } => !!x,
    );

  if (parsed.length === 0) return [];

  const { data: types } = await supabase
    .from("ai_session_types")
    .select("*")
    .in("id", Array.from(typeIds))
    .eq("user_id", user.id);

  const typeMap = new Map<string, AISessionType>(
    (types ?? []).map((t) => [t.id as string, t as AISessionType]),
  );

  // 3. Map rows → UpcomingAISession, filtering out orphaned links (deleted model/type).
  const now = Date.now();
  const out: UpcomingAISession[] = [];
  for (const { row, link } of parsed) {
    const type = typeMap.get(link.session_type_id);
    if (!type || type.model_id !== link.model_id) continue; // stale link
    const when = itemWhen(row);
    // Keep items without time (pure tasks) + any event/reminder not in the past.
    if (when && new Date(when).getTime() < now - 86_400_000) continue;
    out.push({
      item_id: row.id,
      item_title: row.title,
      item_type: row.type,
      when_at: when,
      model_id: link.model_id,
      session_type_id: link.session_type_id,
      session_type_name: type.name,
      estimated_usage_pct: Number(type.estimated_usage_pct) || 0,
    });
  }

  // Sort by scheduled time (nulls last), then by title.
  out.sort((a, b) => {
    if (a.when_at && b.when_at) return a.when_at.localeCompare(b.when_at);
    if (a.when_at) return -1;
    if (b.when_at) return 1;
    return a.item_title.localeCompare(b.item_title);
  });
  return out;
}

export function useUpcomingAISessions() {
  return useQuery({
    queryKey: aiUsageKeys.upcomingSessions(),
    queryFn: fetchUpcomingAISessions,
    staleTime: CACHE_TIMES.TRANSACTIONS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Filter + group helper. Keeps this module's components free of ad-hoc glue.
 */
export function groupSessionsByModel(
  sessions: UpcomingAISession[],
  models: AIUsageModel[],
): Map<string, UpcomingAISession[]> {
  const map = new Map<string, UpcomingAISession[]>();
  for (const m of models) map.set(m.id, []);
  for (const s of sessions) {
    const arr = map.get(s.model_id);
    if (arr) arr.push(s);
  }
  return map;
}
