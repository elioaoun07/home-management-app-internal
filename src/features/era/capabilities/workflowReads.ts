// Source-owned lookup adapters. No model-generated IDs or ingredients are used.
import { z } from "zod";
import { safeFetch } from "@/lib/safeFetch";
import { findReminderCandidates } from "../intents/resolvers/reminderLookup";
import type { EraCapabilityResult } from "./types";

export async function findReminder(hint: string): Promise<EraCapabilityResult> {
  const candidates = await findReminderCandidates(hint);
  if (!candidates) return { text: "Couldn't look up reminders.", ok: false };
  if (candidates.length !== 1)
    return {
      text: candidates.length
        ? `Which reminder? ${candidates.map((c) => c.title).join(" · ")}`
        : `No reminder matches ${hint}.`,
      ok: false,
    };
  const c = candidates[0];
  if (!c.mine || c.recurring)
    return { text: "Open this reminder in Schedule.", ok: false };
  return {
    text: c.title,
    ok: true,
    metadata: { itemId: c.id, title: c.title },
  };
}

/** A resumed lookup receipt preserves identity, not permission/current state.
 * Reuse the Schedule bundle before editing a saved target days later. */
export async function verifyReminderReference(itemId: string, title: string): Promise<EraCapabilityResult | null> {
  const candidates = await findReminderCandidates(title);
  const current = candidates?.find((c) => c.id === itemId);
  return current?.mine && !current.recurring ? null : {
    text: "Reminder changed. Open Schedule.", ok: false, metadata: { notDispatched: true },
  };
}

const recipesSchema = z.array(
  z.object({ id: z.string().min(1), name: z.string().min(1) }),
);
const detailSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  deleted_at: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        quantity: z.union([z.string(), z.number()]).optional(),
        unit: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function recipeIngredients(
  dish: string,
): Promise<EraCapabilityResult> {
  try {
    const res = await safeFetch(
      `/api/recipes?search=${encodeURIComponent(dish)}`,
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return { text: "Couldn't look up recipes.", ok: false };
    const recipes = recipesSchema.parse(await res.json());
    const exact = recipes.filter(
      (r) => r.name.toLowerCase() === dish.trim().toLowerCase(),
    );
    const matches = exact.length ? exact : recipes;
    if (matches.length !== 1)
      return {
        text: matches.length
          ? `Which recipe? ${matches.map((r) => r.name).join(" · ")}`
          : `No recipe matches ${dish}.`,
        ok: false,
      };
    const detailRes = await safeFetch(
      `/api/recipes/${encodeURIComponent(matches[0].id)}`,
      { timeoutMs: 8_000 },
    );
    if (!detailRes.ok) return { text: "Couldn't read that recipe.", ok: false };
    const recipe = detailSchema.parse(await detailRes.json());
    if (recipe.deleted_at || recipe.archived_at || recipe.id !== matches[0].id)
      return { text: "Recipe is no longer available.", ok: false };
    const ingredients = recipe.ingredients.map((i) =>
      [i.quantity, i.unit, i.name, i.notes ? `(${i.notes})` : undefined]
        .filter(Boolean)
        .join(" "),
    );
    return {
      text: `${recipe.name} · ${ingredients.join(", ")}`,
      ok: true,
      metadata: { recipeName: recipe.name, ingredients },
    };
  } catch {
    return { text: "Couldn't read that recipe's ingredients.", ok: false };
  }
}
