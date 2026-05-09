// src/features/era/queryKeys.ts
// Feature-scoped React Query key factory for ERA.

export const eraKeys = {
  all: ["era"] as const,
  household: () => [...eraKeys.all, "household"] as const,
  conversations: () => [...eraKeys.all, "conversations"] as const,
  messages: (conversationId: string | null) =>
    [...eraKeys.all, "messages", conversationId ?? "none"] as const,
  widgets: {
    schedule: () => [...(["era"] as const), "widget", "schedule"] as const,
    budget: () => [...(["era"] as const), "widget", "budget"] as const,
    chef: () => [...(["era"] as const), "widget", "chef"] as const,
    brain: () => [...(["era"] as const), "widget", "brain"] as const,
  },
};
