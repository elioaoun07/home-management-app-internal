import { z } from "zod";
import { RRule } from "rrule";
import { buildFullRRuleString } from "@/lib/utils/date";

const timestamp = z.iso.datetime();
const positive = z.number().int().positive().nullable().optional();
export const prerequisiteSchema = z.object({
  condition_type: z.enum(["nfc_state_change", "item_completed", "weather", "time_window", "schedule", "custom_formula"]),
  condition_config: z.record(z.string(), z.json()),
  logic_group: z.number().int().min(0).default(0),
}).strict().superRefine((p, ctx) => {
  const c = p.condition_config;
  if (p.condition_type === "nfc_state_change" &&
    (!z.uuid().safeParse(c.tag_id).success || typeof c.target_state !== "string" || !c.target_state.trim()))
    ctx.addIssue({ code: "custom", message: "Invalid NFC trigger" });
  if (p.condition_type === "item_completed" && !z.uuid().safeParse(c.prerequisite_item_id).success)
    ctx.addIssue({ code: "custom", message: "Invalid prerequisite item" });
});

export const createItemSchema = z.object({
  // Client-chosen identity: a repeat of the same id returns the item instead of a second one
  id: z.uuid().optional(),
  type: z.enum(["reminder", "task", "event"]),
  title: z.string().trim().min(1).max(1000),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "archived", "dormant", "draft"]).nullable().optional(),
  metadata_json: z.record(z.string(), z.json()).nullable().optional(),
  is_public: z.boolean().default(false),
  responsible_user_id: z.uuid().optional(),
  notify_all_household: z.boolean().default(false),
  category_ids: z.array(z.string()).default([]),
  location_context: z.enum(["home", "outside", "anywhere"]).nullable().optional(),
  location_text: z.string().nullable().optional(),
  source_catalogue_item_id: z.uuid().optional(),
  is_template_instance: z.boolean().default(false),
  is_chore: z.boolean().default(false),
  due_at: timestamp.nullable().optional(),
  estimate_minutes: z.number().int().min(0).nullable().optional(),
  has_checklist: z.boolean().default(false),
  start_at: timestamp.optional(),
  end_at: timestamp.optional(),
  all_day: z.boolean().default(false),
  subtasks: z.array(z.object({ title: z.string().trim().min(1), order_index: z.number().int().min(0).optional() }).strict()).max(200).default([]),
  alerts: z.array(z.object({
    kind: z.enum(["absolute", "relative"]),
    trigger_at: timestamp.nullable().optional(),
    offset_minutes: z.number().int().min(0).nullable().optional(),
    relative_to: z.enum(["start", "end", "due"]).nullable().optional(),
    custom_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    repeat_every_minutes: positive,
    max_repeats: positive,
    channel: z.enum(["push", "email", "sms", "in_app"]).default("push"),
  }).strict()).max(50).default([]),
  // Explicit native helper choice; absent keeps the existing due-time default.
  suppress_default_alert: z.boolean().optional(),
  recurrence_rule: z.object({
    rrule: z.string().min(1), start_anchor: timestamp,
    end_until: timestamp.nullable().optional(), count: positive,
    is_flexible: z.boolean().default(false),
    flexible_period: z.enum(["weekly", "biweekly", "monthly"]).nullable().optional(),
  }).strict().optional(),
  prerequisites: z.array(prerequisiteSchema).max(50).default([]),
}).strict().superRefine((body, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (body.type === "event" && (!body.start_at || !body.end_at || Date.parse(body.end_at) < Date.parse(body.start_at!))) fail("Event requires an ordered start and end");
  if (body.type !== "event" && (body.start_at || body.end_at)) fail("Event dates require an event");
  if (body.type === "event" && (body.due_at || body.estimate_minutes != null || body.has_checklist)) fail("Reminder details require a reminder or task");
  if (body.status === "draft" && body.prerequisites.length) fail("Draft triggers are unavailable");
  if (body.recurrence_rule) {
    try { RRule.fromString(buildFullRRuleString(new Date(body.recurrence_rule.start_anchor), body.recurrence_rule)); }
    catch { fail("Invalid recurrence rule"); }
    // The existing cron advances by numeric offset and has no custom-time
    // zone contract. Do not accept a clock rule it cannot keep on later dates.
    if (body.alerts.some(a => a.custom_time)) fail("Recurring custom-time alerts are unavailable");
  }
  for (const a of body.alerts) {
    if (a.kind === "absolute" && !a.trigger_at) fail("Absolute alert requires a trigger time");
    if (a.kind === "relative" && (a.offset_minutes == null || !(body.type === "event" ? (a.relative_to === "end" ? body.end_at : body.start_at) : body.due_at))) fail("Relative alert requires an offset and date");
    if (a.kind === "relative" && a.relative_to && (body.type === "event" ? a.relative_to === "due" : a.relative_to !== "due")) fail("Alert base does not match the item type");
  }
});
export type CreateItemBody = z.infer<typeof createItemSchema>;

/** Run on the client before queueing, so custom wall-clock alert times use
 * the capture device's zone. The API validates again before the transaction. */
export function prepareItemCreate(input: unknown, now = new Date()): CreateItemBody {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid item");
  const body = parsed.data;
  body.status = body.prerequisites.length ? "dormant" : body.status ?? "pending";
  const rule = body.recurrence_rule;
  const base = (relativeTo?: string | null) => {
    const iso = body.type === "event" ? (relativeTo === "end" ? body.end_at : body.start_at) : body.due_at;
    if (!iso) return null;
    return rule ? RRule.fromString(buildFullRRuleString(new Date(rule.start_anchor), rule)).after(now, true) ?? new Date(iso) : new Date(iso);
  };
  if (body.status === "draft") body.alerts = [];
  else if (!body.alerts.length && body.due_at && !body.suppress_default_alert) body.alerts = [{ kind: "absolute", channel: "push", trigger_at: base()?.toISOString() }];
  body.alerts = body.alerts.map((a) => {
    if (a.kind !== "relative" || a.trigger_at) return a;
    const d = base(a.relative_to)!;
    if (a.custom_time) {
      d.setDate(d.getDate() - Math.floor(a.offset_minutes! / 1440));
      const [h, m] = a.custom_time.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    } else d.setTime(d.getTime() - a.offset_minutes! * 60_000);
    return { ...a, trigger_at: d.toISOString() };
  });
  body.subtasks = body.subtasks.map((s, i) => ({ ...s, order_index: s.order_index ?? i }));
  return body;
}

/** Items per bulk request; the RPC enforces the same ceiling. */
export const BULK_ITEMS_MAX = 50;

/** Bulk create needs every item to carry its own id, which is what makes a retry safe. */
export const bulkCreateItemsSchema = z.object({
  items: z.array(createItemSchema).min(1).max(BULK_ITEMS_MAX),
}).strict().superRefine((body, ctx) => {
  const seen = new Set<string>();
  body.items.forEach((item, index) => {
    const path = ["items", index, "id"];
    if (!item.id) ctx.addIssue({ code: "custom", path, message: "Bulk items need an id" });
    else if (seen.has(item.id)) ctx.addIssue({ code: "custom", path, message: "Duplicate id" });
    else seen.add(item.id);
  });
});
export type BulkCreateItemsBody = z.infer<typeof bulkCreateItemsSchema>;

export const bulkCreateReceiptSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  failed: z.array(z.object({ index: z.number().int().min(0), code: z.string() })),
  completion: z.object({ status: z.enum(["complete", "partial"]) }).passthrough(),
});
export type BulkCreateReceipt = z.infer<typeof bulkCreateReceiptSchema>;

export const bulkDeleteItemsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
}).strict();

export const itemCreateReceiptSchema = z.object({
  item: z.object({ id: z.string().min(1) }).passthrough(),
  completion: z.object({ status: z.literal("complete") }).passthrough(),
});
export const createdItemIdentitySchema = z.object({ item: z.object({ id: z.string().min(1) }).passthrough() });

/** Only a returned PostgreSQL rejection proves rollback. Transport errors
 * returned as Supabase error objects can arrive after a commit. */
export function sourceFailure(code: string | undefined) {
  if (code === "PGRST202") return { status: "not_started" as const };
  return { status: code && /^[A-Z0-9]{5}$/.test(code) ? "rolled_back" as const : "unknown" as const };
}
