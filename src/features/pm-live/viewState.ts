// src/features/pm-live/viewState.ts
// View state for the board: which view is open, the query string, and how rows
// are grouped/sorted. Mirrored into the URL so a filtered board survives a
// reload and can be sent from laptop to phone as a link.
//
// The URL is written with history.replaceState rather than Next's router:
// these are client-only view knobs, and routing through the App Router would
// re-run the route on every keystroke for no benefit.
"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { parseQuery, type ParsedQuery } from "./query";

export type ViewId = "overview" | "board" | "delivery" | "usage" | "campaigns";
export type SessionPane = "questions" | "conversation" | "artifacts" | "cost";
export const SESSION_PANES: readonly SessionPane[] = ["questions", "conversation", "artifacts", "cost"] as const;
export type GroupBy = "campaign" | "lane" | "severity" | "effort" | "none";
export type SortBy = "lane" | "severity" | "effort" | "campaign" | "file";

export const VIEWS: readonly ViewId[] = ["overview", "board", "delivery", "usage", "campaigns"] as const;
export const GROUP_OPTIONS: readonly GroupBy[] = ["campaign", "lane", "severity", "effort", "none"] as const;
export const SORT_OPTIONS: readonly SortBy[] = ["lane", "severity", "effort", "campaign", "file"] as const;

interface ViewState {
  view: ViewId;
  query: string;
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Open session detail, or null for the fleet list. Deep-linked from push notifications. */
  session: string | null;
  pane: SessionPane;
  setView: (view: ViewId) => void;
  setSession: (session: string | null) => void;
  setPane: (pane: SessionPane) => void;
  setQuery: (query: string) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setSortBy: (sortBy: SortBy) => void;
  /** Toggle one `key:value` filter on/off, leaving free text and other filters intact. */
  toggleFilter: (key: string, value: string) => void;
}

function withFilter(query: string, key: string, value: string): string {
  const token = `${key}:${value}`;
  const parts = query.split(/\s+/).filter(Boolean);
  const existing = parts.findIndex((p) => p.toLowerCase().startsWith(`${key}:`));
  if (existing >= 0) {
    const wasSame = parts[existing].toLowerCase() === token.toLowerCase();
    parts.splice(existing, 1);
    if (wasSame) return parts.join(" ");
    return [...parts, token].join(" ");
  }
  return [...parts, token].join(" ");
}

export const useViewState = create<ViewState>((set) => ({
  view: "overview",
  query: "",
  groupBy: "campaign",
  sortBy: "lane",
  session: null,
  pane: "questions",
  // Opening a session implies the delivery view — a deep link should never land
  // on the board with an invisible session selected.
  setView: (view) => set((s) => ({ view, session: view === "delivery" ? s.session : null })),
  setSession: (session) => set({ session, view: session ? "delivery" : "delivery", pane: "questions" }),
  setPane: (pane) => set({ pane }),
  setQuery: (query) => set({ query }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleFilter: (key, value) => set((s) => ({ query: withFilter(s.query, key, value) })),
}));

export const useParsedQuery = (): ParsedQuery => {
  const query = useViewState((s) => s.query);
  return parseQuery(query);
};

function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return !!value && (options as readonly string[]).includes(value);
}

/** Read the URL once on mount, then keep it in step with the store. Mount once, in the shell. */
export function useViewStateUrlSync() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const group = params.get("group");
    const sort = params.get("sort");
    const session = params.get("session");
    const pane = params.get("pane");
    useViewState.setState({
      ...(isOneOf(view, VIEWS) ? { view } : {}),
      ...(isOneOf(group, GROUP_OPTIONS) ? { groupBy: group } : {}),
      ...(isOneOf(sort, SORT_OPTIONS) ? { sortBy: sort } : {}),
      ...(params.get("q") ? { query: params.get("q") as string } : {}),
      // A session deep link forces the delivery view: the notification that sent
      // you here was about that session, not about wherever you last were.
      ...(session ? { session, view: "delivery" as ViewId } : {}),
      ...(isOneOf(pane, SESSION_PANES) ? { pane } : {}),
    });

    return useViewState.subscribe((state) => {
      const next = new URLSearchParams();
      if (state.view !== "overview") next.set("view", state.view);
      if (state.query) next.set("q", state.query);
      if (state.groupBy !== "campaign") next.set("group", state.groupBy);
      if (state.sortBy !== "lane") next.set("sort", state.sortBy);
      if (state.session) next.set("session", state.session);
      if (state.session && state.pane !== "questions") next.set("pane", state.pane);
      const search = next.toString();
      window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
    });
  }, []);
}
