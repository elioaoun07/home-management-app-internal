// src/features/era/queryKeys.ts
// Feature-scoped React Query key factory for ERA.

export const eraKeys = {
  all: ["era"] as const,
  household: () => [...eraKeys.all, "household"] as const,
  conversations: () => [...eraKeys.all, "conversations"] as const,
  /** HUB-52 — the History picker's titled list (a separate shape from `conversations`). */
  history: () => [...eraKeys.all, "history"] as const,
  messages: (conversationId: string | null) =>
    [...eraKeys.all, "messages", conversationId ?? "none"] as const,
  templates: () => [...eraKeys.all, "templates"] as const,
  runs: (conversationId: string | null, owner?: string | null) => [...eraKeys.all, "runs", owner ?? "none", conversationId ?? "none"] as const,
  lexicon: () => [...eraKeys.all, "lexicon"] as const,
  /** HUB-113 — own spends/titles + household shopping rows the composer recalls from. */
  captureMemory: () => [...eraKeys.all, "capture-memory"] as const,
  widgets: {
    schedule: () => [...(["era"] as const), "widget", "schedule"] as const,
    budget: () => [...(["era"] as const), "widget", "budget"] as const,
    chef: () => [...(["era"] as const), "widget", "chef"] as const,
    brain: () => [...(["era"] as const), "widget", "brain"] as const,
  },
  /** The AI Usage view: one local month (yyyy-MM) of model calls. */
  aiUsage: (monthKey: string) => [...eraKeys.all, "ai-usage", monthKey] as const,
  /** The Artifacts view: which days have rows, one day's rows, and each row's live status. */
  artifacts: {
    all: () => [...eraKeys.all, "artifacts"] as const,
    days: () => [...eraKeys.all, "artifacts", "days"] as const,
    day: (dayKey: string) => [...eraKeys.all, "artifacts", "day", dayKey] as const,
    status: (ids: string[]) => [...eraKeys.all, "artifacts", "status", ids.join(",")] as const,
  },
};
