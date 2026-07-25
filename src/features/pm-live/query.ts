// src/features/pm-live/query.ts
// Typed port of scripts/pm/src/features/search/queryLang.js so the phone/web
// board and the desktop `pnpm pm` board speak ONE filter mini-language. The
// five original keys (m, t, s, is, f) behave identically — tests/pm-live-query
// asserts that parity — plus two additions this surface needs: `lane:` and
// `e:` (effort).
//
//   m:Budget s:blocker is:open lane:now e:S "rounding drift"
//
// Keep both files in step if the grammar ever moves, the same way
// _Conventions.md requires of tasks.mjs and packet.mjs.

import type { PmTask } from "./types";

export const FILTER_KEYS = ["m", "t", "s", "is", "f", "lane", "e"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type QueryFilters = Partial<Record<FilterKey, string>>;

export interface ParsedQuery {
  filters: QueryFilters;
  text: string;
}

const KEY_SET = new Set<string>(FILTER_KEYS);
// Bare words, or quoted phrases that may contain spaces.
const TOKEN_RE = /(?:[^\s"]+|"[^"]*")+/g;

export function parseQuery(input: string): ParsedQuery {
  const filters: QueryFilters = {};
  const terms: string[] = [];
  const tokens = String(input || "").match(TOKEN_RE) || [];
  for (const token of tokens) {
    const match = token.match(/^([^:]+):(.*)$/);
    const key = match?.[1]?.toLowerCase();
    if (match && key && KEY_SET.has(key)) filters[key as FilterKey] = match[2].replace(/^"|"$/g, "");
    else terms.push(token.replace(/^"|"$/g, ""));
  }
  return { filters, text: terms.join(" ").trim() };
}

/** Serialize back to the input form — used to keep the URL in sync with chip toggles. */
export function stringifyQuery({ filters, text }: ParsedQuery): string {
  const parts = FILTER_KEYS.filter((k) => filters[k]).map((k) => {
    const value = filters[k] as string;
    return `${k}:${/\s/.test(value) ? `"${value}"` : value}`;
  });
  if (text) parts.push(text);
  return parts.join(" ");
}

const contains = (haystack: unknown, needle: string) => String(haystack ?? "").toLowerCase().includes(needle.toLowerCase());
const equals = (value: unknown, needle: string) => String(value ?? "").toLowerCase() === needle.toLowerCase();

export function matchesFilters(task: PmTask, filters: QueryFilters): boolean {
  if (filters.m && !contains(task.module, filters.m)) return false;
  // Everything on this surface is a checklist task; `t:` exists for parity with
  // the desktop board, where docs and pain bullets share the same index.
  if (filters.t && !equals("task", filters.t)) return false;
  if (filters.s && !equals(task.severity, filters.s)) return false;
  if (filters.is && !equals(task.state, filters.is)) return false;
  if (filters.f && !contains(task.file, filters.f)) return false;
  if (filters.lane && !equals(task.section, filters.lane)) return false;
  if (filters.e && !equals(task.effort, filters.e)) return false;
  return true;
}

/** Free-text match across the fields a person would actually search by. */
export function matchesText(task: PmTask, text: string): boolean {
  if (!text) return true;
  const needle = text.toLowerCase();
  return (
    task.text.toLowerCase().includes(needle) ||
    (task.idChip || "").toLowerCase().includes(needle) ||
    task.module.toLowerCase().includes(needle)
  );
}

export function matchesQuery(task: PmTask, parsed: ParsedQuery): boolean {
  return matchesFilters(task, parsed.filters) && matchesText(task, parsed.text);
}
