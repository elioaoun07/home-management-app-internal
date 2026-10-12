// src/features/era/capabilities/registry.ts
// ERA Stage 1 — the actual catalog. Each entry wraps an existing resolver
// (which itself wraps an existing API route) — see types.ts's module doc
// for why this layer exists. Expose the most useful existing actions first;
// grow this list from real usage, not speculatively.

import { reminderValues } from "./effectiveAction";
import { parseSmartText } from "@/lib/smartTextParser";
import { z } from "zod";
import { formatDate } from "@/lib/utils/date";
import {
  resolveMemoryRecall,
  resolveMemorySave,
} from "../intents/resolvers/brain";
import {
  resolveConfirmDraft,
  resolveListDrafts,
  resolveMonthSpend,
} from "../intents/resolvers/budget";
import {
  resolveAssignMeal,
  resolveListRecipes,
  resolveRecipeSearch,
} from "../intents/resolvers/chef";
import {
  resolveDraftReminder,
  resolveReminderComplete,
  resolveReminderDelete,
  resolveReminderReschedule,
  resolveScheduleForDay,
} from "../intents/resolvers/schedule";
import type { FaceKey } from "../types";
import type { EraCapability, EraEntityType } from "./types";
import {
  resolveAddShopping,
  listOpenShoppingItems,
} from "../intents/resolvers/shopping";
import {
  findReminder,
  recipeIngredients,
  verifyReminderReference,
} from "./workflowReads";
import { describeApplication } from "./discovery";

const scheduleForDay: EraCapability<{ dateISO?: string }> = {
  id: "schedule.forDay",
  module: "Items / Reminders",
  description: "Read the day's schedule, including occurrences and overdue items for today.",
  sources: [{ kind: "rpc", name: "get_schedule_bundle" }],
  entity: "schedule",
  operation: "read",
  slots: z.object({
    dateISO: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-MM-dd")
      .optional(),
  }),
  execute: (slots, context) =>
    resolveScheduleForDay(
      slots.dateISO ??
        (context?.referenceDate
          ? formatDate(context.referenceDate)
          : undefined),
    ),
};

const reminderCreate: EraCapability<{ rawText: string; title?: string }> = {
  id: "reminder.create",
  confirmation: { resolveAtWrite: true, title: "Create reminder", fields: { title: "Title", due_at: "Due", priority: "Priority", recurrence: "Repeat", alert: "Alert" }, initialValues: reminderValues },
  module: "Items / Reminders",
  description: "Create a one-time reminder from the user's date/time text; missing dates ask a question.",
  sources: [{ kind: "api", path: "/api/items", methods: ["POST"] }],
  constraints: ["rawText preserves the user's request verbatim for the app date parser; title is optional.", "Recurring reminders require the Schedule page; this adapter does not create a series."],
  entity: "reminder",
  operation: "create",
  slots: z.object({
    rawText: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  execute: (slots, context) =>
    resolveDraftReminder(slots.rawText, slots.title, context?.referenceDate, context?.beforeWrite),
};

const reminderReschedule: EraCapability<{
  itemId: string;
  whenText: string;
  title?: string;
}> = {
  id: "reminder.reschedule",
  confirmation: { resolveAtWrite: true, title: "Move reminder", fields: { itemId: "Item", title: "Title", due_at: "Due", previousDueAt: "Was", whenText: "When" } },
  module: "Items / Reminders",
  description: "Move one owned, open, non-recurring reminder to a new date/time.",
  sources: [{ kind: "api", path: "/api/items/[id]", methods: ["PATCH"] }],
  constraints: ["whenText preserves the user's day/time wording; obtain itemId from reminder.find or current FOCUS."],
  entity: "reminder",
  operation: "update",
  slots: z.object({
    itemId: z.string().min(1),
    whenText: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  entityRefSlot: "itemId",
  referenceSource: { entity: "reminder", field: "itemId" },
  execute: async (slots, context) => {
    const blocked =
      context?.referenceDate &&
      (await verifyReminderReference(slots.itemId, slots.title ?? ""));
    if (blocked) return blocked;
    return resolveReminderReschedule(
      slots.itemId,
      slots.title ?? null,
      slots.whenText,
      context?.referenceDate,
      context?.beforeWrite,
    );
  },
};

const reminderComplete: EraCapability<{ itemId: string; title?: string }> = {
  id: "reminder.complete",
  confirmation: { resolveAtWrite: true, title: "Complete reminder", fields: { itemId: "Item", title: "Title", occurrence_date: "Date" } },
  module: "Items / Reminders",
  description: "Complete one owned, non-recurring reminder.",
  sources: [{ kind: "api", path: "/api/items/[id]/complete", methods: ["POST"] }],
  entity: "reminder",
  operation: "complete",
  slots: z.object({
    itemId: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  entityRefSlot: "itemId",
  referenceSource: { entity: "reminder", field: "itemId" },
  execute: async (slots, context) => {
    const blocked =
      context?.referenceDate &&
      (await verifyReminderReference(slots.itemId, slots.title ?? ""));
    if (blocked) return blocked;
    return resolveReminderComplete(slots.itemId, slots.title ?? null, context?.beforeWrite);
  },
};

const reminderDelete: EraCapability<{ itemId: string; title?: string }> = {
  id: "reminder.delete",
  confirmation: { resolveAtWrite: true, title: "Delete reminder", fields: { itemId: "Item", title: "Title", effect: "Effect" }, initialValues: s => ({ ...s, effect: "Recycle Bin" }) },
  module: "Items / Reminders",
  description: "Soft-delete one owned reminder to the Recycle Bin.",
  sources: [{ kind: "api", path: "/api/items/[id]", methods: ["DELETE"] }],
  entity: "reminder",
  operation: "delete",
  destructive: true,
  slots: z.object({
    itemId: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  entityRefSlot: "itemId",
  referenceSource: { entity: "reminder", field: "itemId" },
  execute: async (slots, context) => {
    const blocked =
      context?.referenceDate &&
      (await verifyReminderReference(slots.itemId, slots.title ?? ""));
    if (blocked) return blocked;
    return resolveReminderDelete(slots.itemId, slots.title ?? null, context?.beforeWrite);
  },
};

// ─────────────────────────────── Stage D (plan) ───────────────────────────────
// Widens the registry past reminder/schedule so a taught template (HUB-30)
// can point at more of the app than five reminder actions. Each entry below
// wraps an existing resolver exactly like the five above — no new business
// logic, no new balance math (money-rules: `spend.month`/`draft.*` are reads
// or a status flip on an already-computed draft, never new money math).
//
// `transaction.draft` (log a new spend via chat) is DELIBERATELY NOT here —
// `resolveDraftTransaction` (resolvers/budget.ts) needs `useEraBudgetSubmit`,
// a React hook bound to the user's accounts/categories/query client
// (resolveIntent.ts's `ResolveDeps`, on purpose, keeps that out of any
// module-level singleton). Wiring a hook's live function into a plain
// `execute(slots)` call would mean either a stale closure or a new
// imperative-ref pattern for money-writing code — out of scope for widening
// the registry; revisit only with a specific need and its own review.

const spendMonth: EraCapability<{
  scope: "self" | "partner" | "household";
  categoryHint?: string;
}> = {
  id: "spend.month",
  module: "Transactions",
  description: "Read spending for the custom billing month, scoped to self, partner or household.",
  sources: [{ kind: "api", path: "/api/transactions", methods: ["GET"] }],
  entity: "transaction",
  operation: "read",
  slots: z.object({
    scope: z.enum(["self", "partner", "household"]),
    categoryHint: z.string().min(1).max(60).optional(),
  }),
  execute: (slots) => resolveMonthSpend(slots.scope, slots.categoryHint),
};

const draftList: EraCapability<Record<string, never>> = {
  id: "draft.list",
  module: "Drafts",
  description: "List pending transaction drafts for review.",
  sources: [{ kind: "api", path: "/api/drafts", methods: ["GET"] }],
  entity: "transaction",
  operation: "read",
  slots: z.object({}),
  execute: () => resolveListDrafts(),
};

const draftConfirm: EraCapability<{ hint?: string }> = {
  id: "draft.confirm",
  confirmation: { resolveAtWrite: true, title: "Confirm expense", fields: { hint: "Draft", id: "Draft", amount: "Amount", currency: "Currency", account_id: "Account", account: "Account", category_id: "Category", subcategory_id: "Subcategory", description: "Description", date: "Date" } },
  module: "Drafts",
  description: "Confirm an existing pending transaction draft, matched uniquely by hint or most recent if omitted.",
  sources: [
    { kind: "api", path: "/api/drafts", methods: ["GET"] },
    { kind: "api", path: "/api/drafts/[id]", methods: ["PATCH"] },
  ],
  constraints: ["Does not create a new expense or change the draft amount; ambiguous hints stop."],
  entity: "transaction",
  operation: "update",
  slots: z.object({ hint: z.string().min(1).max(80).optional() }),
  execute: (slots, context) => resolveConfirmDraft(slots.hint, context?.beforeWrite),
};

const recipeSearch: EraCapability<{ dish: string }> = {
  id: "recipe.search",
  module: "Recipes",
  description: "Search saved recipes by dish name.",
  sources: [{ kind: "api", path: "/api/recipes", methods: ["GET"] }],
  entity: "recipe",
  operation: "read",
  slots: z.object({ dish: z.string().min(1).max(80) }),
  execute: (slots) => resolveRecipeSearch(slots.dish),
};

const recipeList: EraCapability<Record<string, never>> = {
  id: "recipe.list",
  module: "Recipes",
  description: "List saved recipes.",
  sources: [{ kind: "api", path: "/api/recipes", methods: ["GET"] }],
  entity: "recipe",
  operation: "read",
  slots: z.object({}),
  execute: () => resolveListRecipes(),
};

const mealAssign: EraCapability<{
  dish: string;
  dayHint: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}> = {
  id: "meal.assign",
  confirmation: { resolveAtWrite: true, title: "Assign meal", fields: { dish: "Recipe", recipe_id: "Recipe", planned_date: "Date", meal_type: "Meal", effect: "Effect" }, initialValues: (s, d) => ({ dish: s.dish, planned_date: parseSmartText(String(s.dayHint), d).dueDate ?? null, meal_type: s.mealType ?? "lunch", effect: "Replace occupied slot / Both" }) },
  module: "Meal Planning",
  description: "Assign a saved recipe to a day and meal slot (default lunch).",
  sources: [
    { kind: "api", path: "/api/recipes", methods: ["GET"] },
    { kind: "api", path: "/api/meal-plans", methods: ["POST"] },
  ],
  constraints: ["For recipe workflows bind dish to recipe.ingredients.recipeName; assignment replaces an occupied slot. No scaling or pantry subtraction."],
  entity: "meal",
  operation: "create",
  slots: z.object({
    dish: z.string().min(1).max(80),
    dayHint: z.string().min(1).max(40),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  }),
  execute: (slots, context) =>
    resolveAssignMeal(
      slots.dish,
      slots.dayHint,
      slots.mealType,
      context?.referenceDate,
      context?.beforeWrite,
    ),
};

const memorySave: EraCapability<{ label: string; value: string }> = {
  id: "memory.save",
  confirmation: { title: "Save household memory", fields: { label: "Label", value: "Value" } },
  module: "AI Assistant",
  description: "Save a labeled household memory.",
  sources: [{ kind: "api", path: "/api/memories", methods: ["POST"] }],
  constraints: ["Existing labels are not overwritten; updating memories is unavailable."],
  entity: "memory",
  operation: "create",
  slots: z.object({
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(500),
  }),
  execute: (slots) => resolveMemorySave(slots.label, slots.value),
};

const memoryRecall: EraCapability<{ query: string }> = {
  id: "memory.recall",
  module: "AI Assistant",
  description: "Recall a saved household memory by query.",
  sources: [{ kind: "api", path: "/api/memories", methods: ["GET"] }],
  outputs: {
    label: { schema: z.string().min(1), example: "WiFi" },
    value: { schema: z.string().min(1).max(500), example: "household-network" },
  },
  entity: "memory",
  operation: "read",
  slots: z.object({ query: z.string().min(1).max(80) }),
  execute: (slots) => resolveMemoryRecall(slots.query),
};

const reminderFind: EraCapability<{ hint: string }> = {
  id: "reminder.find",
  module: "Items / Reminders",
  description: "Resolve a named reminder to exactly one owned, open, non-recurring reminder.",
  sources: [{ kind: "rpc", name: "get_schedule_bundle" }],
  constraints: ["Ambiguous, partner-owned or recurring matches stop. Bind later reminder itemId to itemId and title to title."],
  entity: "reminder",
  operation: "read",
  slots: z.object({ hint: z.string().trim().min(1).max(100) }),
  outputs: {
    itemId: { schema: z.string().min(1), example: "resolved-id" },
    title: { schema: z.string().min(1), example: "Dentist" },
  },
  execute: ({ hint }) => findReminder(hint),
};

const ingredients: EraCapability<{ dish: string }> = {
  id: "recipe.ingredients",
  module: "Recipes",
  description: "Read the actual ingredients of one uniquely matched saved recipe.",
  sources: [
    { kind: "api", path: "/api/recipes", methods: ["GET"] },
    { kind: "api", path: "/api/recipes/[id]", methods: ["GET"] },
  ],
  constraints: ["Ambiguous recipes stop. Bind meal.assign dish to recipeName and shopping.add items to ingredients; never invent ingredients."],
  entity: "recipe",
  operation: "read",
  slots: z.object({ dish: z.string().trim().min(1).max(80) }),
  outputs: {
    recipeName: { schema: z.string().min(1), example: "Chicken" },
    ingredients: {
      schema: z.array(z.string().min(1)).min(1).max(50),
      example: ["500 g chicken"],
    },
  },
  execute: ({ dish }) => recipeIngredients(dish),
};

const shoppingAdd: EraCapability<{ items: string[]; groupHint?: string }> = {
  id: "shopping.add",
  confirmation: { resolveAtWrite: true, title: "Add shopping items", fields: { items: "Items", groupHint: "Group", groupId: "Group", groupName: "Group", threadId: "List", unresolvedGroup: "Pending group" }, initialValues: s => ({ items: s.items, groupHint: s.groupHint ?? "General" }) },
  module: "Shopping List",
  description: "Add item texts to the household shopping list, optionally in a named group.",
  sources: [
    { kind: "api", path: "/api/hub/threads", methods: ["GET"] },
    { kind: "api", path: "/api/hub/messages", methods: ["POST"] },
    { kind: "api", path: "/api/hub/shopping-groups", methods: ["GET", "POST", "PATCH"] },
  ],
  constraints: ["For recipe ingredients use recipe.ingredients output. No automatic deduplication or stock subtraction; a partial batch is not safe to replay."],
  entity: "shopping",
  operation: "create",
  slots: z.object({
    items: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
    groupHint: z.string().trim().min(1).max(80).optional(),
  }),
  execute: ({ items, groupHint }, context) =>
    resolveAddShopping(items, groupHint, context?.onProgress, context?.beforeWrite),
};

const shoppingList: EraCapability<Record<string, never>> = {
  id: "shopping.list",
  module: "Shopping List",
  description: "Read open shopping items.",
  sources: [
    { kind: "api", path: "/api/hub/threads", methods: ["GET"] },
    { kind: "api", path: "/api/hub/messages", methods: ["GET"] },
  ],
  entity: "shopping",
  operation: "read",
  slots: z.object({}),
  execute: async () => {
    const list = await listOpenShoppingItems();
    if (!list) return { text: "Couldn't read the shopping list.", ok: false };
    return {
      text: list.items.length
        ? list.items.map((i) => i.content).join(", ")
        : "Shopping list is empty.",
      ok: true,
      metadata: { count: list.items.length, threadId: list.threadId },
    };
  },
};

const appCapabilities: EraCapability<{ query?: string }> = {
  id: "app.capabilities",
  entity: "application",
  operation: "read",
  module: "AI Assistant",
  description: "Explain ERA's current executable capabilities and precision pages across application modules.",
  sources: [],
  slots: z.object({ query: z.string().trim().min(1).max(100).optional() }),
  constraints: ["query is an optional module name or topic. Pages and native-only actions are not registered agent actions."],
  execute: async ({ query }) => describeApplication(ERA_CAPABILITIES, query),
};

/**
 * The full catalog, keyed by id. `reminder.setRecurrence` from the design
 * doc is deliberately NOT here yet — the doc's own caveat is "only if the
 * backend already supports it", and updating a recurrence rule via chat
 * needs occurrence-aware handling this session didn't build (see
 * `resolveReminderComplete`'s recurring-item guard for why that's not a
 * small addition). See the Stage D comment above for why `transaction.draft`
 * is the one budget action still missing.
 */
export const ERA_CAPABILITIES: Record<string, EraCapability<unknown>> = {
  [appCapabilities.id]: appCapabilities,
  [scheduleForDay.id]: scheduleForDay,
  [reminderCreate.id]: reminderCreate,
  [reminderReschedule.id]: reminderReschedule,
  [reminderComplete.id]: reminderComplete,
  [reminderDelete.id]: reminderDelete,
  [spendMonth.id]: spendMonth,
  [draftList.id]: draftList,
  [draftConfirm.id]: draftConfirm,
  [recipeSearch.id]: recipeSearch,
  [recipeList.id]: recipeList,
  [mealAssign.id]: mealAssign,
  [memorySave.id]: memorySave,
  [memoryRecall.id]: memoryRecall,
  [reminderFind.id]: reminderFind,
  [ingredients.id]: ingredients,
  [shoppingAdd.id]: shoppingAdd,
  [shoppingList.id]: shoppingList,
};

export function getCapability(id: string): EraCapability<unknown> | undefined {
  return Object.hasOwn(ERA_CAPABILITIES, id) ? ERA_CAPABILITIES[id] : undefined;
}

/** Which ERA face owns a given capability's entity. */
const ENTITY_FACE: Record<EraEntityType, FaceKey> = {
  application: "brain",
  reminder: "schedule",
  schedule: "schedule",
  transaction: "budget",
  recipe: "chef",
  meal: "chef",
  memory: "brain",
  shopping: "chef",
};

export function entityFace(entity: EraEntityType): FaceKey {
  return ENTITY_FACE[entity];
}
