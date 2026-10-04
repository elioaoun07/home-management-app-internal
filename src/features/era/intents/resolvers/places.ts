// src/features/era/intents/resolvers/places.ts
// HUB-88 / HUB-94 — places ERA learns. A place is a Catalogue item in the
// "Places" module: a custom module ERA creates on the first save and marks
// with settings_json.era_role = "places" (no DB change). A module the owner
// already named "Places"/"Locations" is adopted instead of creating a second.
// Aliases are the item's tags ("parents" → Parents' house), editable in
// Catalogue; pinned places come first in ERA's "Where?" chips.
//
// Routes reused (the Catalogue UI's own): GET/POST /api/catalogue/modules,
// GET/POST /api/catalogue/items, DELETE /api/catalogue/items/[id] (Undo →
// Recycle Bin). Items are private by default, like contacts.

import { type EraArtifact, eraArtifact } from "@/lib/era/artifacts";
import { safeFetch } from "@/lib/safeFetch";
import { routeWrite, type RouteWriteResult } from "./routeWrite";

export interface EraPlace {
  id: string;
  name: string;
  tags: string[];
}

interface ModuleRow {
  id: string;
  type?: string;
  name?: string;
  settings_json?: Record<string, unknown> | null;
}

const PLACES_NAME_RE = /^(?:my\s+)?(?:places|locations)$/i;

export function pickPlacesModule(modules: ModuleRow[]): ModuleRow | null {
  return (
    modules.find((m) => m.settings_json?.era_role === "places") ??
    modules.find((m) => PLACES_NAME_RE.test((m.name ?? "").trim())) ??
    null
  );
}

/** Lowercase, possessives folded, punctuation and a leading article dropped. */
export function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`]s\b/g, "s")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(?:the|my|our)\s+/, "")
    .trim();
}

/** "at the parents house." → "Parents house"; empty when nothing is left. */
export function tidyPlaceName(s: string): string {
  const t = s
    .trim()
    .replace(/^(?:at|@)\s+/i, "")
    .replace(/^["“'](.*)["”']$/, "$1")
    .replace(/[\s.!?,;:]+$/, "")
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

const keysOf = (p: EraPlace) => [p.name, ...p.tags].map(normalizePlace).filter((k) => k.length > 0);
const hasWords = (hay: string, needle: string) => needle.length >= 3 && ` ${hay} `.includes(` ${needle} `);

/** A saved place a phrase names: an exact name or tag, else one unique whole-word overlap. */
export function matchPlace(places: EraPlace[], phrase: string): EraPlace | null {
  const p = normalizePlace(phrase);
  if (!p) return null;
  const exact = places.filter((pl) => keysOf(pl).includes(p));
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  const partial = places.filter((pl) => keysOf(pl).some((k) => hasWords(k, p) || hasWords(p, k)));
  return partial.length === 1 ? partial[0] : null;
}

/** A saved place named anywhere in a phrase (whole words; the longest name wins, ties lose). */
export function findPlaceInText(places: EraPlace[], text: string): EraPlace | null {
  const t = normalizePlace(text);
  let best: EraPlace | null = null;
  let bestLen = 0;
  let tie = false;
  for (const pl of places) {
    for (const k of keysOf(pl)) {
      if (!hasWords(t, k)) continue;
      if (k.length > bestLen) {
        best = pl;
        bestLen = k.length;
        tie = false;
      } else if (k.length === bestLen && best?.id !== pl.id) {
        tie = true;
      }
    }
  }
  return best && !tie ? best : null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await safeFetch(url, { timeoutMs: 8_000 });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** The Places module (null when none exists yet) and its places; `null` when unreadable. */
export async function loadPlaces(): Promise<{ moduleId: string | null; places: EraPlace[] } | null> {
  try {
    const modules = await getJson<ModuleRow[]>("/api/catalogue/modules");
    if (!Array.isArray(modules)) return null;
    const mod = pickPlacesModule(modules);
    if (!mod) return { moduleId: null, places: [] };
    const rows = await getJson<Array<{ id: string; name: string; tags?: string[] | null }>>(
      `/api/catalogue/items?module_id=${encodeURIComponent(mod.id)}`,
    );
    if (!Array.isArray(rows)) return null;
    return {
      moduleId: mod.id,
      places: rows.map((r) => ({ id: r.id, name: r.name, tags: Array.isArray(r.tags) ? r.tags : [] })),
    };
  } catch {
    return null;
  }
}

export interface SavePlaceResult extends RouteWriteResult {
  placeId?: string;
}

/**
 * Save a place to Catalogue → Places, creating the module the first time.
 * A place that already exists (name or tag) is reported, never duplicated.
 */
export async function savePlace(name: string, reply: (name: string) => string): Promise<SavePlaceResult> {
  const clean = tidyPlaceName(name);
  if (!clean) return { text: "Save which place?", ok: false };
  const fail: SavePlaceResult = { text: "Couldn't save that.", ok: false };
  try {
    const loaded = await loadPlaces();
    if (!loaded) return fail;
    const existing = loaded.places.find((p) => keysOf(p).includes(normalizePlace(clean)));
    if (existing) {
      return { text: `Already in Places · ${existing.name}`, ok: true, placeId: existing.id, metadata: { placeId: existing.id, place: existing.name } };
    }

    let moduleId = loaded.moduleId;
    const created: EraArtifact[] = [];
    if (!moduleId) {
      const res = await safeFetch("/api/catalogue/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "custom",
          name: "Places",
          icon: "map-pin",
          color: "#0ea5e9",
          settings_json: { era_role: "places" },
        }),
        timeoutMs: 8_000,
      });
      if (!res.ok) return fail;
      moduleId = ((await res.json().catch(() => null)) as { id?: string } | null)?.id ?? null;
      if (!moduleId) return fail;
      created.push(eraArtifact("catalogue_module", "created", moduleId, "Places"));
    }

    const r = await routeWrite({
      call: { url: "/api/catalogue/items", method: "POST", body: { module_id: moduleId, name: clean } },
      pickId: (json) => (json as { id?: string } | null)?.id,
      artifact: { entity: "place", action: "created", title: clean },
      inverse: (id) => ({ url: `/api/catalogue/items/${id}`, method: "DELETE" }),
      reply: reply(clean),
      failReply: fail.text,
      idKey: "placeId",
      extraMetadata: { moduleId, place: clean },
    });
    const placeId = typeof r.metadata?.placeId === "string" ? r.metadata.placeId : undefined;
    // The place first (it is what the turn made); a new module is logged too.
    return { ...r, placeId, artifacts: [...(r.artifacts ?? []), ...created] };
  } catch {
    return fail;
  }
}

/** "Add Kobeize as a location" (HUB-88). */
export function resolveAddPlace(name: string): Promise<SavePlaceResult> {
  return savePlace(name, (n) => `Added · ${n}`);
}
