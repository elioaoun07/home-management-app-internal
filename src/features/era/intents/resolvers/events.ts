// src/features/era/intents/resolvers/events.ts
// HUB-94 — ERA creates events and learns the places you go.
//   1. The event is written first, with Undo, through POST /api/items (the
//      route the event form uses). No date yet → "When?" and nothing is
//      written until one is known.
//   2. Its place: a saved place named in the sentence fills the location
//      with no question; a new "at X" fills it and offers [Save] to Places;
//      none → "Where?" with the first saved places + [Skip]. The answer
//      PATCHes the event (PATCH /api/items/[id], the edit dialog's route).
//   3. [Save] adds the place to Catalogue → Places (resolvers/places.ts).
// The id travels as `eventId`, never `itemId`: focus memory reads `itemId`
// as a reminder, and "move it to 9" must not PATCH an event's due_at.

import { describeWhen } from "@/lib/era/phrasing";
import { parseRelativeDate } from "@/lib/smartTextParser";
import { formatDate, localToISO } from "@/lib/utils/date";
import type { EraChipOption, EraPendingSlot } from "../../types";
import { eventWhen, parseEvent } from "../eventText";
import { loadPlaces, matchPlace, findPlaceInText, savePlace, tidyPlaceName, type EraPlace } from "./places";
import { routeWrite } from "./routeWrite";
import { slot, type SlotResult } from "./slotBuilders";

interface EventArgs {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  date: string;
}

function whenLabel(startAt: string, allDay: boolean): string {
  const w = describeWhen(startAt);
  return allDay ? w.replace(/\s+at\s+.*$/, "") : w;
}

function pendingSlot(
  capability: EraPendingSlot["capability"],
  slotName: string,
  question: string,
  options: EraChipOption[],
  args: Record<string, unknown>,
  rawText: string,
): EraPendingSlot {
  return { kind: "slot", capability, slot: slotName, question, options, args, rawText, createdAt: Date.now() };
}

function askWhere(places: EraPlace[], a: EventArgs, rawText: string): EraPendingSlot {
  return pendingSlot(
    "event.location",
    "place",
    "Where?",
    [...places.slice(0, 3).map((p) => ({ label: p.name, value: `place:${p.id}` })), { label: "Skip", value: "skip" }],
    { ...a },
    rawText,
  );
}

function askSave(name: string, rawText: string): EraPendingSlot {
  return pendingSlot(
    "place.save",
    "save",
    `Save "${name}" to Places?`,
    [
      { label: "Save", value: "save" },
      { label: "No", value: "no" },
    ],
    { name },
    rawText,
  );
}

/** "add an event dinner at Parents tomorrow at 8pm". */
export async function resolveDraftEvent(intent: { title: string; placeHint?: string; rawText: string }): Promise<SlotResult> {
  const parts = parseEvent(intent.rawText);
  const title = intent.title || parts?.title || "Event";
  const placeHint = intent.placeHint ?? parts?.placeHint;
  if (parts?.recurring) {
    return { text: "Repeating events need the form.", ok: false, metadata: { handoff: "event.recurring" }, navigate: "/reminders" };
  }
  if (!parts?.date) {
    return slot(
      "event.when",
      "date",
      "When?",
      [
        { label: "Today", value: "today" },
        { label: "Tomorrow", value: "tomorrow" },
      ],
      { title, ...(placeHint ? { placeHint } : {}), ...(parts?.time ? { time: parts.time } : {}) },
      intent.rawText,
    );
  }
  return createEvent(title, placeHint, parts.date, parts.time, intent.rawText);
}

async function createEvent(
  title: string,
  placeHint: string | undefined,
  date: string,
  time: string | undefined,
  rawText: string,
): Promise<SlotResult> {
  // Unreadable places never block the event; it just can't match or offer them.
  const places = (await loadPlaces())?.places ?? [];
  const known = placeHint ? matchPlace(places, placeHint) : findPlaceInText(places, title);
  const placeName = known?.name ?? (placeHint ? tidyPlaceName(placeHint) : "");

  const allDay = !time;
  const startAt = localToISO(date, allDay ? "00:00" : time);
  const endAt = allDay ? localToISO(date, "23:59") : new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString();

  const r = await routeWrite({
    call: {
      url: "/api/items",
      method: "POST",
      body: {
        type: "event",
        title,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay,
        ...(placeName ? { location_text: placeName } : {}),
        ...(known ? { metadata_json: { place_id: known.id } } : {}),
      },
    },
    pickId: (json) => (json as { item?: { id?: string } } | null)?.item?.id,
    artifact: { entity: "event", action: "created", title, ref: { date } },
    inverse: (id) => ({ url: `/api/items/${id}`, method: "DELETE" }),
    reply: ["Added", title, whenLabel(startAt, allDay), placeName].filter(Boolean).join(" · "),
    failReply: "Couldn't add that.",
    idKey: "eventId",
    extraMetadata: { title, startAt, ...(placeName ? { place: placeName } : {}), ...(known ? { placeId: known.id } : {}) },
  });
  if (!r.ok) return r;

  const eventId = r.metadata?.eventId as string;
  if (known) return { ...r, pending: null };
  if (placeName) return { ...r, pending: askSave(placeName, rawText) };
  return { ...r, pending: askWhere(places, { eventId, title, startAt, endAt, allDay, date }, rawText) };
}

// ───────────────────────────── answers ─────────────────────────────

/** "When?" → a date (chip or typed); anything without one is a new request. */
export async function answerEventWhen(pending: EraPendingSlot, text: string, chip?: string): Promise<SlotResult | { unmatched: true }> {
  const src = chip ?? text;
  if (!parseRelativeDate(src)) return { unmatched: true };
  const when = eventWhen(src);
  if (!when.date) return { unmatched: true };
  const a = pending.args as { title: string; placeHint?: string; time?: string };
  return createEvent(a.title, a.placeHint, when.date, when.time ?? a.time, pending.rawText);
}

const SKIP_RE = /^\s*(?:skip|no(?:ne|where)?|nope|not\s+now|no\s+(?:place|location))\s*[.!]*\s*$/i;

/** "Where?" → a saved place (chip or name) or a new place typed freely. */
export async function answerEventLocation(pending: EraPendingSlot, text: string, chip?: string): Promise<SlotResult | { unmatched: true }> {
  if (chip === "skip" || (!chip && SKIP_RE.test(text))) return { text: "Skipped.", pending: null };
  const a = pending.args as unknown as EventArgs;
  const places = (await loadPlaces())?.places ?? [];
  const chipPlaceId = chip?.startsWith("place:") ? chip.slice(6) : null;
  const known = chipPlaceId
    ? (places.find((p) => p.id === chipPlaceId) ?? {
        id: chipPlaceId,
        name: pending.options.find((o) => o.value === chip)?.label ?? text,
        tags: [],
      })
    : matchPlace(places, text);
  const name = known?.name ?? tidyPlaceName(text);
  if (!name || name.length > 80) return { unmatched: true };

  const r = await setEventPlace(a, name, known?.id);
  if (!r.ok || known) return { ...r, pending: null };
  return { ...r, pending: askSave(name, pending.rawText) };
}

async function setEventPlace(a: EventArgs, name: string, placeId: string | undefined): Promise<SlotResult> {
  // start/end ride along: the route only writes event_details.location_text with them.
  const times = { start_at: a.startAt, end_at: a.endAt, all_day: a.allDay };
  return routeWrite({
    call: {
      url: `/api/items/${a.eventId}`,
      method: "PATCH",
      body: { ...times, location_text: name, ...(placeId ? { metadata_json: { place_id: placeId } } : {}) },
    },
    pickId: () => a.eventId,
    artifact: { entity: "event", action: "updated", title: a.title, ref: { date: a.date || formatDate(new Date(a.startAt)) } },
    inverse: (id) => ({
      url: `/api/items/${id}`,
      method: "PATCH",
      body: { ...times, location_text: null, ...(placeId ? { metadata_json: null } : {}) },
    }),
    reply: `${a.title} · ${name}`,
    failReply: "Couldn't set the place.",
    idKey: "eventId",
    extraMetadata: { title: a.title, place: name, locationSet: true, ...(placeId ? { placeId } : {}) },
  });
}

const YES_RE = /^\s*(?:save|yes|yeah|yep|sure|ok(?:ay)?|y)\b/i;
const NO_RE = /^\s*(?:no|nope|nah|not\s+now|skip|don'?t)\b/i;

/** `Save "Kobeize" to Places?` → [Save] / [No]. */
export async function answerPlaceSave(pending: EraPendingSlot, text: string, chip?: string): Promise<SlotResult | { unmatched: true }> {
  const yes = chip === "save" || (!chip && YES_RE.test(text));
  const no = chip === "no" || (!chip && NO_RE.test(text));
  if (!yes && !no) return { unmatched: true };
  if (no) return { text: "Not saved.", pending: null };
  const r = await savePlace(String(pending.args.name ?? ""), (n) => `Saved · ${n}`);
  return { ...r, pending: null };
}
