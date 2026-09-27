"use client";

// src/features/era/useEraLexicon.ts
// HUB-80 — mirrors the caller's live lexicon into useEraStore so resolvers
// read it synchronously every turn (same pattern as useEraTemplates). The
// API answers 503 until the owner runs 2026-09-27_era-lexicon.sql; then ERA
// just runs without a lexicon.

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import type { LexiconRule } from "./lexicon";
import { eraKeys } from "./queryKeys";
import { useEraStore } from "./useEraStore";

export type LexiconRuleInput = Omit<LexiconRule, "id" | "use_count">;

async function fetchLexicon(): Promise<LexiconRule[]> {
  try {
    const res = await safeFetch("/api/era/lexicon", { timeoutMs: 8_000 });
    if (!res.ok) return [];
    const { rules } = (await res.json()) as { rules: LexiconRule[] };
    return rules ?? [];
  } catch {
    return [];
  }
}

export function useEraLexicon() {
  const query = useQuery({
    queryKey: eraKeys.lexicon(),
    queryFn: fetchLexicon,
    staleTime: CACHE_TIMES.RECURRING,
    refetchOnWindowFocus: false,
  });
  const setLexicon = useEraStore((s) => s.setLexicon);
  useEffect(() => {
    if (query.data) setLexicon(query.data);
  }, [query.data, setLexicon]);
  return query;
}

/** Save a rule; mirrors it into the store immediately. Never throws. */
export async function saveLexiconRule(input: LexiconRuleInput): Promise<LexiconRule | null> {
  try {
    const res = await safeFetch("/api/era/lexicon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      timeoutMs: 8_000,
    });
    if (!res.ok) return null;
    const { rule } = ((await res.json().catch(() => ({}))) ?? {}) as { rule?: LexiconRule };
    // Only a real row enters the store (a missing table or odd body must
    // never poison the rules every turn reads).
    if (!rule || typeof rule.id !== "string" || typeof rule.kind !== "string") return null;
    const store = useEraStore.getState();
    store.setLexicon([
      rule,
      ...store.lexicon.filter(
        (r) =>
          !(
            input.kind === "default" &&
            r.kind === "default" &&
            r.capability === input.capability &&
            r.slot === input.slot &&
            JSON.stringify(r.conditions) === JSON.stringify(input.conditions)
          ),
      ),
    ]);
    return rule;
  } catch {
    return null;
  }
}

/** Revoke ("Forget"); removes it from the store even if the call fails later. */
export async function forgetLexiconRule(id: string): Promise<boolean> {
  const store = useEraStore.getState();
  store.setLexicon(store.lexicon.filter((r) => r.id !== id));
  try {
    const res = await safeFetch(`/api/era/lexicon?id=${encodeURIComponent(id)}`, { method: "DELETE", timeoutMs: 8_000 });
    return res.ok;
  } catch {
    return false;
  }
}
