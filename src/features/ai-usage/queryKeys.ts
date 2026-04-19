// src/features/ai-usage/queryKeys.ts
export const aiUsageKeys = {
  all: ["ai-usage"] as const,
  models: () => [...aiUsageKeys.all, "models"] as const,
  sessionTypes: (modelId: string) =>
    [...aiUsageKeys.all, "session-types", modelId] as const,
  upcomingSessions: () => [...aiUsageKeys.all, "upcoming-sessions"] as const,
};
