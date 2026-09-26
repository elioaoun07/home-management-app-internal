import { z } from "zod";

export const ACTIVITY_MODULES = {
  budget: "Budget",
  schedule: "Schedule",
  chat: "Chat",
  kitchen: "Kitchen",
  catalogue: "Catalogue",
  trips: "Trips",
  healthcare: "Healthcare",
  outfits: "Outfits",
  era: "ERA",
  guests: "Guest Portal",
  notifications: "Notifications",
  settings: "Settings",
} as const;
export type ActivityModule = keyof typeof ACTIVITY_MODULES;

export const activityFiltersSchema = z
  .object({
    module: z
      .enum(
        Object.keys(ACTIVITY_MODULES) as [ActivityModule, ...ActivityModule[]],
      )
      .optional(),
    feature: z
      .string()
      .regex(/^[a-z_]+$/)
      .max(40)
      .optional(),
    actor: z.enum(["me", "partner", "system"]).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .refine(
        (value) =>
          /^[1-9]\d{0,18}$/.test(value) &&
          BigInt(value) <= BigInt("9223372036854775807"),
      )
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    (value) =>
      !value.from ||
      !value.until ||
      Date.parse(value.from) < Date.parse(value.until),
    {
      message: "Invalid date range",
      path: ["until"],
    },
  );
export type ActivityFilters = Omit<
  z.infer<typeof activityFiltersSchema>,
  "before" | "limit"
>;

export interface ActivityEvent {
  id: string;
  occurred_at: string;
  module: ActivityModule;
  feature: string;
  action: string;
  source_table: string;
  source_id: string;
  title: string;
  actor_id: string | null;
  owner_id: string;
  actor_name: string;
  changed_fields: string[];
  parent_id: string | null;
  available: boolean;
}
export interface ActivityPage {
  events: ActivityEvent[];
  next_cursor: string | null;
  viewer_id: string;
  recording_since: string | null;
  sources: Array<{
    table: string;
    module: ActivityModule;
    feature: string;
    label: string;
  }>;
}

// Routes come from known source types, never captured user text.
export function activitySourceHref(event: ActivityEvent): string | null {
  if (!event.available) return null;
  // Guest destinations are slug-based. Never expose or fabricate a UUID URL.
  if (event.module === "guests") return null;
  const id = encodeURIComponent(event.source_id);
  const parent = event.parent_id ? encodeURIComponent(event.parent_id) : null;
  if (event.source_table === "transactions") return `/dashboard?openId=${id}`;
  if (event.source_table === "items") return `/items?openId=${id}`;
  if (event.source_table === "trips") return `/trips/${id}`;
  if (event.source_table.startsWith("trip_") && parent)
    return `/trips/${parent}`;
  if (event.source_table === "hub_chat_threads") return `/chat?thread=${id}`;
  if (
    ["hub_messages", "hub_notes_topics", "shopping_groups"].includes(
      event.source_table,
    ) &&
    parent
  )
    return `/chat?thread=${parent}`;
  if (
    (event.source_table.startsWith("item_") ||
      ["reminder_details", "event_details", "recurrence_pauses"].includes(
        event.source_table,
      )) &&
    parent
  )
    return `/items?openId=${parent}`;
  const homes: Record<ActivityModule, string> = {
    budget: "/expense",
    schedule: "/reminders",
    chat: "/chat",
    kitchen: "/recipe",
    catalogue: "/catalogue",
    trips: "/trips",
    healthcare: "/healthcare",
    outfits: "/outfits",
    era: "/era",
    guests: "/era",
    notifications: "/alerts",
    settings: "/era",
  };
  if (event.feature === "meals") return "/meal-plan";
  if (event.feature === "inventory") return "/catalogue";
  return homes[event.module] ?? null;
}
