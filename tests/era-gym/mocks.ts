// tests/era-gym/mocks.ts
// Fake household data sources for the Gym (HUB-78): the reminder bundle the
// by-name lookup reads, and the minimal Supabase surface the reminder
// resolvers touch. Wired with vi.mock in gym.test.ts / record.test.ts.

import { HOUSEHOLD } from "./understand";

const DUE = "2026-09-28T09:00:00.000Z";

export async function fakeFetchItems() {
  return HOUSEHOLD.reminders.map((r) => ({
    id: r.id,
    title: r.title,
    type: "reminder",
    status: "pending",
    user_id: r.owner === "owner" ? "owner-id" : "partner-id",
    reminder_details: { due_at: DUE },
    recurrence_rule: r.rrule ? { rrule: r.rrule } : null,
  }));
}

export function fakeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "owner-id" } } }) },
    rpc: async () => ({ data: { items: [] }, error: null }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              table === "reminder_details"
                ? { due_at: DUE }
                : table === "items"
                  ? { id: "x", reminder_details: { due_at: DUE }, item_recurrence_rules: [] }
                  : null,
            error: null,
          }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }),
  };
}
