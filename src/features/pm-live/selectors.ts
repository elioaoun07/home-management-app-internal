// src/features/pm-live/selectors.ts
// Thin memoized hook layer over derive.ts. Everything here is memoized against
// the raw snapshot + view state, so grouping ~480 tasks happens on a real
// change rather than on every bridge heartbeat. The logic itself lives in
// derive.ts, React-free, so it can be tested in this repo's node-environment
// test setup.
"use client";

import { useMemo } from "react";
import {
  computeAttention,
  computeKpis,
  computeSeverityMix,
  computeTokenTotals,
  computeVelocity,
  filterTasks,
  groupTasks,
  sortCampaigns,
  TERMINAL_STATES,
} from "./derive";
import { useFleet, useHistory, useRollups, useSessions, useTasks } from "./store";
import { useParsedQuery, useViewState } from "./viewState";

export { TERMINAL_STATES, pmTaskKey } from "./derive";
export type { AttentionItem, PmKpis, TaskGroup } from "./derive";

export function useFilteredTasks() {
  const tasks = useTasks();
  const parsed = useParsedQuery();
  return useMemo(() => filterTasks(tasks?.tasks || [], parsed), [tasks, parsed]);
}

export function useGroupedTasks() {
  const filtered = useFilteredTasks();
  const groupBy = useViewState((s) => s.groupBy);
  const sortBy = useViewState((s) => s.sortBy);
  return useMemo(() => groupTasks(filtered, groupBy, sortBy), [filtered, groupBy, sortBy]);
}

export function useKpis() {
  const tasks = useTasks();
  const rollups = useRollups();
  const history = useHistory();
  const fleet = useFleet();
  return useMemo(() => computeKpis(tasks?.tasks || [], rollups, history, fleet), [tasks, rollups, history, fleet]);
}

export function useSeverityMix() {
  const tasks = useTasks();
  const rollups = useRollups();
  return useMemo(() => computeSeverityMix(tasks?.tasks || [], rollups), [tasks, rollups]);
}

export function useVelocitySeries(days = 30) {
  const history = useHistory();
  return useMemo(() => computeVelocity(history?.completedByDay || [], days), [history, days]);
}

export function useAttentionItems() {
  const fleet = useFleet();
  const sessions = useSessions();
  const tasks = useTasks();
  return useMemo(() => computeAttention(fleet, sessions, tasks?.tasks || []), [fleet, sessions, tasks]);
}

export function useActiveSessions() {
  const fleet = useFleet();
  return useMemo(() => (fleet?.sessions || []).filter((s) => !TERMINAL_STATES.has(s.state)), [fleet]);
}

export function useRecentSessions(limit = 5) {
  const fleet = useFleet();
  return useMemo(() => (fleet?.sessions || []).filter((s) => TERMINAL_STATES.has(s.state)).slice(0, limit), [fleet, limit]);
}

export function useCampaignRollups() {
  const rollups = useRollups();
  return useMemo(() => sortCampaigns(rollups?.campaigns || []), [rollups]);
}

export function useTokenTotals() {
  const fleet = useFleet();
  const sessions = useSessions();
  return useMemo(() => computeTokenTotals(fleet, sessions), [fleet, sessions]);
}
