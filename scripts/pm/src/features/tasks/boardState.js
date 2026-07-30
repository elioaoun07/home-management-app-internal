// Pure board view-state: the query string is the single source of truth for
// what the board shows, so a filtered board can be reloaded, bookmarked and
// pasted to yourself. Nothing here touches the DOM — the view calls
// `writeBoardState` to persist, and reads back from the parsed route.
import { parseQuery } from "../search/queryLang.js";

export const GROUP_OPTIONS = ["lane", "campaign", "severity", "effort", "none"];
export const SORT_OPTIONS = ["lane", "severity", "effort", "campaign", "file"];

export const GROUP_LABEL = { lane: "Lane", campaign: "Campaign", severity: "Severity", effort: "Effort", none: "No grouping" };
export const SORT_LABEL = { lane: "Lane order", severity: "Severity", effort: "Effort", campaign: "Campaign", file: "File order" };

export const QUICK_FILTERS = [
  { key: "s", value: "blocker", label: "Blockers" },
  { key: "lane", value: "Now", label: "Now" },
  { key: "e", value: "S", label: "Small" },
  { key: "is", value: "done", label: "Done" },
];

const SEVERITY_RANK = { blocker: 0, friction: 1, annoyance: 2, parked: 3 };
const EFFORT_RANK = { S: 0, M: 1, L: 2 };
const LANE_RANK = { now: 0, next: 1, later: 2 };

/**
 * Add, replace or remove a `key:value` token in a query string.
 * Toggling the same value off is what makes the quick-filter chips behave like
 * chips rather than radio buttons; a different value for the same key replaces
 * it, because these filters are single-valued by grammar.
 */
export function toggleFilterToken(query, key, value) {
  const tokens = String(query || "").match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const prefix = `${key.toLowerCase()}:`;
  const isSame = (token) => token.toLowerCase().startsWith(prefix) && token.slice(prefix.length).replace(/^"|"$/g, "").toLowerCase() === value.toLowerCase();
  const isKey = (token) => token.toLowerCase().startsWith(prefix);
  const already = tokens.some(isSame);
  const rest = tokens.filter((token) => !isKey(token));
  return (already ? rest : [...rest, `${key}:${value}`]).join(" ").trim();
}

export function isFilterActive(query, key, value) {
  const active = parseQuery(query).filters[key.toLowerCase() === "effort" ? "e" : key.toLowerCase()];
  return String(active || "").toLowerCase() === value.toLowerCase();
}

function laneRank(task) {
  const rank = LANE_RANK[String(task.section || "").toLowerCase()];
  return rank === undefined ? 3 : rank;
}

export function sortTasks(tasks, sortBy) {
  const byText = (a, b) => String(a.text || "").localeCompare(String(b.text || ""));
  const compare = {
    lane: (a, b) => laneRank(a) - laneRank(b) || (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || byText(a, b),
    severity: (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || laneRank(a) - laneRank(b) || byText(a, b),
    effort: (a, b) => (EFFORT_RANK[a.effort] ?? 9) - (EFFORT_RANK[b.effort] ?? 9) || laneRank(a) - laneRank(b) || byText(a, b),
    campaign: (a, b) => String(a.module || "").localeCompare(String(b.module || "")) || laneRank(a) - laneRank(b),
    file: (a, b) => String(a.file || "").localeCompare(String(b.file || "")) || (a.cbidx ?? 0) - (b.cbidx ?? 0),
  }[sortBy] || compare_lane_fallback;
  return [...tasks].sort(compare);
}
function compare_lane_fallback(a, b) { return laneRank(a) - laneRank(b); }

/**
 * Group into rendered sections. `lane` always emits all three lanes (an empty
 * Now lane is information — it means nothing is in flight); every other grouping
 * emits only the groups that have members, ordered by the same rank the sort
 * uses so the page reads consistently whichever control you touched.
 */
export function groupTasks(tasks, groupBy) {
  if (groupBy === "none") return [{ key: "all", label: "All tasks", items: tasks }];

  if (groupBy === "lane") {
    return ["Now", "Next", "Later", "Other"].map((label) => ({
      key: label,
      label,
      items: tasks.filter((task) => (label === "Other"
        ? laneRank(task) === 3
        : String(task.section || "").toLowerCase() === label.toLowerCase())),
    })).filter((group) => group.label !== "Other" || group.items.length > 0);
  }

  const keyOf = { campaign: (t) => t.module || "—", severity: (t) => t.severity || "unrated", effort: (t) => t.effort || "unsized" }[groupBy];
  const rankOf = { severity: (k) => SEVERITY_RANK[k] ?? 9, effort: (k) => EFFORT_RANK[k] ?? 9, campaign: () => 0 }[groupBy];
  const buckets = new Map();
  for (const task of tasks) {
    const key = keyOf(task);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(task);
  }
  return [...buckets.entries()]
    .sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || a[0].localeCompare(b[0]))
    .map(([key, items]) => ({ key, label: key, items }));
}

/** Normalize whatever is in the URL into a complete, valid board state. */
export function readBoardState(query) {
  const get = (key) => (query && typeof query.get === "function" ? query.get(key) : null);
  const groupBy = get("group");
  const sortBy = get("sort");
  return {
    query: get("q") || "",
    groupBy: GROUP_OPTIONS.includes(groupBy) ? groupBy : "lane",
    sortBy: SORT_OPTIONS.includes(sortBy) ? sortBy : "lane",
  };
}

/** `#/tasks` + only the params that differ from the defaults — clean URLs stay shareable. */
export function boardHash(path, state) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.groupBy && state.groupBy !== "lane") params.set("group", state.groupBy);
  if (state.sortBy && state.sortBy !== "lane") params.set("sort", state.sortBy);
  const search = params.toString();
  return `#${path}${search ? `?${search}` : ""}`;
}
