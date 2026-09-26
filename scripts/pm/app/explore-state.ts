import {
  boardQueryString,
  laneOf,
  LANES,
  parseBoardQuery,
  type BoardFilters,
  type Lane,
} from "./model";
import type { Bucket, Work } from "./types";

export const exploreBucket = (query: URLSearchParams): Bucket | null => {
  const value = query.get("bucket") || query.get("lane");
  return value && ["now", "next", "waiting", "later"].includes(value)
    ? (value as Bucket)
    : null;
};

export function explorePath(
  query: URLSearchParams,
  patch: Record<string, string> = {},
) {
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `/explore${params.size ? `?${params}` : ""}`;
}

/** Status and layout changes preserve the search and the user's To do context. */
export function exploreViewPath(
  query: URLSearchParams,
  view: "todo" | "done" | "search" | "board" | "list",
) {
  const params = new URLSearchParams(query);
  const current = params.get("view");
  if (view === "done") {
    if (current !== "done")
      params.set(
        "todoView",
        current === "board" || current === "list" ? current : "search",
      );
  } else {
    if (view === "todo") {
      const previous = current === "done" ? params.get("todoView") : current;
      view = previous === "board" || previous === "list" ? previous : "search";
      if (params.get("status") === "review") params.delete("status");
    }
    params.delete("todoView");
    const bucket = exploreBucket(params);
    // Board's capitalized lane selects a mobile column; the lowercase queue
    // is a filter. Keep them separate when changing the presentation.
    if (view === "board" || view === "list") {
      if (bucket) params.set("bucket", bucket);
      if (!LANES.includes(params.get("lane") as Lane)) {
        const column = bucketColumn(bucket);
        if (column) params.set("lane", column);
        else params.delete("lane");
      }
      if (!params.has("campaigns") && params.has("campaign")) {
        params.set("campaigns", params.get("campaign")!);
        params.delete("campaign");
      }
    } else {
      params.delete("bucket");
      if (bucket) params.set("lane", bucket);
      else params.delete("lane");
      if (params.get("status") === "review") params.delete("status");
    }
  }
  return explorePath(params, { view: view === "search" ? "" : view });
}

/** Board controls change only their own fields, retaining search and queue. */
export function boardFilterPath(
  basePath: string,
  query: URLSearchParams,
  patch: Partial<BoardFilters>,
) {
  const params = new URLSearchParams(query);
  if (patch.campaigns) params.delete("campaign");
  const next = new URLSearchParams(
    boardQueryString({ ...parseBoardQuery(query), ...patch }),
  );
  // An explicit Now choice must survive serialization too; omission means
  // the column may follow the first matching result on a phone.
  const selectedLane = patch.lane || query.get("lane");
  if (LANES.includes(selectedLane as Lane)) next.set("lane", selectedLane!);
  for (const key of ["view", "status", "campaigns", "kind", "lane"]) {
    params.delete(key);
    const value = next.get(key);
    if (value) params.set(key, value);
  }
  return `${basePath}?${params}`;
}

const bucketColumn = (bucket: Bucket | null): Lane | null =>
  bucket === "now"
    ? "Now"
    : bucket === "next"
      ? "Next"
      : bucket === "later"
        ? "Later"
        : null;

/** A filtered board opens on matching work unless its column was chosen. */
export function boardVisibleLane(query: URLSearchParams, work: Work[]): Lane {
  const selected = query.get("lane") as Lane;
  if (LANES.includes(selected)) return selected;
  return (
    bucketColumn(exploreBucket(query)) ||
    LANES.find((lane) => work.some((item) => laneOf(item) === lane)) ||
    "Now"
  );
}
