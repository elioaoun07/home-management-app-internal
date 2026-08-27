"use client";

// src/features/era/templates/useEraTemplates.ts
// ERA Stage 4 (HUB-30) — loads the caller's taught-phrase templates and
// mirrors them into `useEraStore` so the router's Layer 2 matcher
// (intents/index.ts) can read them SYNCHRONOUSLY, the same way it already
// reads `activeFaceKey`/`focusEntities` — a DB round trip per keystroke
// would break the command bar's latency guarantee (see types.ts's
// IntentRouter doc). Mount this once per ERA session (useEraTurn does) —
// a stale cache just means a taught phrase's first use after mount waits
// for the query to resolve; nothing is unsafe about it.
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { eraKeys } from "../queryKeys";
import { useEraStore } from "../useEraStore";
import type { EraTemplate } from "./matcher";

export interface EraTemplateRow {
  id: string;
  capability_id: string;
  pattern_text: string;
  slot_names: string[];
  source_text: string;
  match_count: number;
  enabled: boolean;
  created_at: string;
  last_matched_at: string | null;
}

async function fetchEraTemplates(): Promise<EraTemplateRow[]> {
  const res = await safeFetch("/api/era/templates", { timeoutMs: 8_000 });
  if (!res.ok) return [];
  const { templates } = (await res.json()) as { templates: EraTemplateRow[] };
  return templates;
}

function toMatcherTemplate(row: EraTemplateRow): EraTemplate {
  return {
    id: row.id,
    capabilityId: row.capability_id,
    patternText: row.pattern_text,
    slotNames: row.slot_names,
    enabled: row.enabled,
  };
}

export function useEraTemplates() {
  const query = useQuery({
    queryKey: eraKeys.templates(),
    queryFn: fetchEraTemplates,
    staleTime: CACHE_TIMES.RECURRING,
    refetchOnWindowFocus: false,
  });

  const setTemplates = useEraStore((s) => s.setTemplates);
  useEffect(() => {
    if (query.data) setTemplates(query.data.map(toMatcherTemplate));
  }, [query.data, setTemplates]);

  return query;
}

/** Fire-and-forget — bumps a template's match_count after the Layer 2 matcher used it natively (resolveIntent's `capabilityAction` case). Never awaited; a lost race is harmless telemetry. */
export function bumpTemplateMatch(templateId: string): void {
  safeFetch(`/api/era/templates/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bump: true }),
  }).catch(() => {});
}
