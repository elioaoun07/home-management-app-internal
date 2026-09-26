import type { ActivityFilters } from "./types";
export const activityLogKeys = {
  all: ["activity-log"] as const,
  feed: (userId: string, filters: ActivityFilters) =>
    ["activity-log", userId, filters] as const,
};
