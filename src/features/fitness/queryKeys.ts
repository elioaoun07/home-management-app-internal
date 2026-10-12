// src/features/fitness/queryKeys.ts
// "fitness" is a persisted root (STABLE_KEYS in src/app/providers.tsx) so the
// active plan and unfinished workout render offline after a restart.
export const fitnessKeys = {
  all: ["fitness"] as const,
  bundle: () => [...fitnessKeys.all, "bundle"] as const,
  fixture: (state: string) => [...fitnessKeys.all, "fixture", state] as const,
  history: () => [...fitnessKeys.all, "history"] as const,
  session: (id: string) => [...fitnessKeys.all, "session", id] as const,
  pending: () => [...fitnessKeys.all, "pending"] as const,
};
