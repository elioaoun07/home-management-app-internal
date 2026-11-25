// src/features/era/intents/resolvers/contacts.ts
// HUB-89 — "add Laura as a contact". HUB-123 — contacts filed under a
// Catalogue category: "add Laura as a contact under Family", "move Racha
// contact under Family". HUB-93 — a plain add of a new contact writes nothing:
// it opens the Catalogue form prefilled (/catalogue?newContact=). Source-owned
// adapter over the routes the Catalogue contacts module already uses:
//   GET   /api/catalogue/modules                  the `contacts` module
//   GET   /api/catalogue/items?module_id=         its contacts (dedupe, lookup)
//   GET   /api/catalogue/categories?module_id=    its categories
//   POST  /api/catalogue/items                    create   · Undo: DELETE (Recycle Bin)
//   PATCH /api/catalogue/items/[id] {category_id} file     · Undo: PATCH back
//   POST  /api/catalogue/categories               only after [Create] · Undo: DELETE (archive)
// A category matches by exact name (case, articles and a plural "s" aside),
// never a near-name: a missing one is always offered, never guessed.

import { eraArtifact } from "@/lib/era/artifacts";
import { safeFetch } from "@/lib/safeFetch";
import type { EraChipOption, EraPendingSlot } from "../../types";
import { routeWrite, type RouteWriteResult } from "./routeWrite";
import { slot, type SlotResult } from "./slotBuilders";

interface ContactRow {
  id: string;
  name: string;
  category_id: string | null;
}
interface CategoryRow {
  id: string;
  name: string;
}
export interface ContactsBook {
  moduleId: string;
  contacts: ContactRow[];
  categories: CategoryRow[];
}

const enc = encodeURIComponent;
const FAIL_ADD = "Couldn't add that.";
const FAIL_MOVE = "Couldn't move that.";
const MAX_CHIPS = 4;

/** Lowercase words only: "Dr. Karam" → "dr karam". */
export function normalizeContact(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`]s\b/g, "s")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "the family category" → "Family"; empty when nothing is left. */
export function tidyCategoryName(s: string): string {
  const t = s
    .trim()
    .replace(/^["“'](.*)["”']$/, "$1")
    .replace(/^(?:the|my|our)\s+/i, "")
    .replace(/\s+(?:category|categories|group|section|folder)\s*$/i, "")
    .replace(/[\s.!?,;:]+$/, "")
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

const categoryKey = (s: string) => normalizeContact(tidyCategoryName(s)).replace(/s$/, "");

export function matchCategory(categories: CategoryRow[], hint: string): CategoryRow | null {
  const k = categoryKey(hint);
  if (!k) return null;
  return categories.find((c) => categoryKey(c.name) === k) ?? null;
}

/** Contacts a name points at: exact name first, else whole-word overlap ("Racha" → "Racha Aoun"). */
export function matchContacts(contacts: ContactRow[], name: string): ContactRow[] {
  const n = normalizeContact(name);
  if (!n) return [];
  const exact = contacts.filter((c) => normalizeContact(c.name) === n);
  if (exact.length > 0) return exact;
  return contacts.filter((c) => ` ${normalizeContact(c.name)} `.includes(` ${n} `));
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await safeFetch(url, { timeoutMs: 8_000 });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** The Contacts module with its contacts and categories; "none" without a module; null when unreadable. */
export async function loadContactsBook(): Promise<ContactsBook | "none" | null> {
  try {
    const modules = await getJson<Array<{ id: string; type?: string }>>("/api/catalogue/modules");
    if (!Array.isArray(modules)) return null;
    const mod = modules.find((m) => m.type === "contacts");
    if (!mod) return "none";
    const [items, categories] = await Promise.all([
      getJson<ContactRow[]>(`/api/catalogue/items?module_id=${enc(mod.id)}`),
      getJson<CategoryRow[]>(`/api/catalogue/categories?module_id=${enc(mod.id)}`),
    ]);
    if (!Array.isArray(items) || !Array.isArray(categories)) return null;
    return {
      moduleId: mod.id,
      contacts: items.map((r) => ({ id: r.id, name: r.name, category_id: r.category_id ?? null })),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    };
  } catch {
    return null;
  }
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

const contactArgs = (c: ContactRow) => ({ contactId: c.id, name: c.name, previousCategoryId: c.category_id });

/** After an add: "Category?" → the first categories, a door to the contact's details, [Skip]. */
function askCategory(book: ContactsBook, c: ContactRow, rawText: string): EraPendingSlot {
  return pendingSlot(
    "contact.category",
    "category",
    "Category?",
    [
      ...book.categories.slice(0, MAX_CHIPS).map((cat) => ({ label: cat.name, value: `cat:${cat.id}` })),
      { label: "Details", value: `nav:/catalogue?item=${enc(c.id)}` },
      { label: "Skip", value: "skip" },
    ],
    contactArgs(c),
    rawText,
  );
}

const CREATE_OPTIONS: EraChipOption[] = [
  { label: "Create", value: "create" },
  { label: "No", value: "no" },
];

/** A category that does not exist yet: ask before creating it (no write). */
function askCreate(categoryName: string, c: ContactRow, rawText: string): SlotResult {
  return slot(
    "contact.newCategory",
    "create",
    `No "${categoryName}" category. Create it?`,
    CREATE_OPTIONS,
    { ...contactArgs(c), category: categoryName },
    rawText,
  );
}

/** PATCH the contact's category through the Catalogue edit route; Undo restores the previous one. */
function fileContact(c: ContactRow, cat: CategoryRow): Promise<RouteWriteResult> {
  return routeWrite({
    call: { url: `/api/catalogue/items/${c.id}`, method: "PATCH", body: { category_id: cat.id } },
    pickId: () => c.id,
    artifact: { entity: "contact", action: "updated", title: c.name },
    inverse: (id) => ({ url: `/api/catalogue/items/${id}`, method: "PATCH", body: { category_id: c.category_id } }),
    reply: `${c.name} → ${cat.name}`,
    failReply: FAIL_MOVE,
    idKey: "contactId",
    extraMetadata: { name: c.name, category: cat.name, categoryId: cat.id, contactAction: "moved" },
  });
}

/** File an existing contact: known category → move; already there → say so; missing → ask to create. */
async function fileOrAsk(book: ContactsBook, c: ContactRow, hint: string, rawText: string): Promise<SlotResult> {
  const cat = matchCategory(book.categories, hint);
  if (!cat) return askCreate(tidyCategoryName(hint), c, rawText);
  if (c.category_id === cat.id) {
    return {
      text: `Already in ${cat.name} · ${c.name}`,
      ok: true,
      metadata: { contactId: c.id, name: c.name, category: cat.name, contactAction: "kept" },
    };
  }
  return fileContact(c, cat);
}

/** "add Laura as a contact [under Family]". An existing contact is reused, never duplicated (HUB-95). */
export async function resolveAddContact(name: string, categoryHint?: string, rawText = ""): Promise<SlotResult> {
  const clean = name.trim();
  if (!clean) return { text: "Add who?", ok: false };
  const book = await loadContactsBook();
  if (book === "none") return { text: "No contacts module.", ok: false };
  if (!book) return { text: FAIL_ADD, ok: false };
  const hint = categoryHint ? tidyCategoryName(categoryHint) : "";

  const existing = book.contacts.find((c) => normalizeContact(c.name) === normalizeContact(clean));
  if (existing) {
    if (hint) return fileOrAsk(book, existing, hint, rawText);
    const base: SlotResult = {
      text: `Already in Contacts · ${existing.name}`,
      ok: true,
      metadata: { contactId: existing.id, name: existing.name, contactAction: "exists" },
    };
    return !existing.category_id && book.categories.length > 0
      ? { ...base, pending: askCategory(book, existing, rawText) }
      : base;
  }

  // HUB-93 — a new contact has fields worth filling, so a plain add opens the
  // Catalogue form prefilled; nothing is saved until Save.
  if (!hint) {
    return {
      text: `New contact · ${clean}`,
      navigate: `/catalogue?newContact=${encodeURIComponent(clean)}`,
      metadata: { name: clean, contactAction: "form" },
    };
  }

  const cat = matchCategory(book.categories, hint);
  const r = await routeWrite({
    call: {
      url: "/api/catalogue/items",
      method: "POST",
      body: { module_id: book.moduleId, name: clean, ...(cat ? { category_id: cat.id } : {}) },
    },
    pickId: (json) => (json as { id?: string } | null)?.id,
    artifact: { entity: "contact", action: "created", title: clean },
    inverse: (id) => ({ url: `/api/catalogue/items/${id}`, method: "DELETE" }),
    reply: cat ? `Added · ${clean} · ${cat.name}` : `Added · ${clean}`,
    failReply: FAIL_ADD,
    idKey: "contactId",
    extraMetadata: {
      moduleId: book.moduleId,
      name: clean,
      contactAction: "created",
      ...(cat ? { category: cat.name, categoryId: cat.id } : {}),
    },
  });
  if (!r.ok || cat) return r;

  const created: ContactRow = { id: String(r.metadata?.contactId), name: clean, category_id: null };
  return { ...r, pending: askCreate(hint, created, rawText).pending };
}

/** "move Racha contact under Family". `onlyIfKnown`: null instead of a reply when no contact matches. */
export async function resolveMoveContact(name: string, categoryHint: string, rawText: string): Promise<SlotResult>;
export async function resolveMoveContact(
  name: string,
  categoryHint: string,
  rawText: string,
  onlyIfKnown: true,
): Promise<SlotResult | null>;
export async function resolveMoveContact(
  name: string,
  categoryHint: string,
  rawText: string,
  onlyIfKnown = false,
): Promise<SlotResult | null> {
  const book = await loadContactsBook();
  if (book === "none" || !book) {
    return onlyIfKnown ? null : { text: book === "none" ? "No contacts module." : FAIL_MOVE, ok: false };
  }
  const hint = tidyCategoryName(categoryHint);
  const matches = matchContacts(book.contacts, name);
  if (matches.length === 0) return onlyIfKnown ? null : { text: `No contact "${name.trim()}".`, ok: false };
  if (!hint) return { text: "Which category?", ok: false };
  if (matches.length > 1) {
    return slot(
      "contact.pick",
      "contact",
      "Which one?",
      matches.slice(0, MAX_CHIPS).map((c) => ({ label: c.name, value: `contact:${c.id}` })),
      { category: hint },
      rawText,
    );
  }
  return fileOrAsk(book, matches[0], hint, rawText);
}

// ───────────────────────────── answers ─────────────────────────────

type Answer = SlotResult | { unmatched: true };

const SKIP_RE = /^\s*(?:skip|no(?:ne|pe)?|nah|not\s+now|later)\s*[.!]*\s*$/i;
const YES_RE = /^\s*(?:create|yes|yeah|yep|sure|ok(?:ay)?|y|do\s+it)\b/i;
const NO_RE = /^\s*(?:no|nope|nah|not\s+now|skip|cancel|don'?t)\b/i;

function argsContact(pending: EraPendingSlot): ContactRow {
  const a = pending.args;
  return {
    id: String(a.contactId ?? ""),
    name: String(a.name ?? ""),
    category_id: typeof a.previousCategoryId === "string" ? a.previousCategoryId : null,
  };
}

/** "Category?" → a category chip, a typed category (a new name asks to create it), or [Skip]. */
export async function answerContactCategory(pending: EraPendingSlot, text: string, chip?: string): Promise<Answer> {
  if (chip?.startsWith("nav:")) return { unmatched: true };
  if (chip === "skip" || (!chip && SKIP_RE.test(text))) return { text: "Skipped.", pending: null };
  const book = await loadContactsBook();
  if (book === "none" || !book) return { text: FAIL_MOVE, ok: false, pending: null };
  const contact = argsContact(pending);
  const chosenId = chip?.startsWith("cat:") ? chip.slice(4) : null;
  const cat = chosenId ? (book.categories.find((c) => c.id === chosenId) ?? null) : matchCategory(book.categories, text);
  if (cat) return { ...(await fileContact(contact, cat)), pending: null };
  if (chosenId) return { text: FAIL_MOVE, ok: false, pending: null };
  const name = tidyCategoryName(text);
  if (!name || name.length > 40 || name.split(/\s+/).length > 4 || /[\d$€£]/.test(name)) return { unmatched: true };
  return askCreate(name, contact, pending.rawText);
}

/** `No "Family" category. Create it?` → [Create] makes it (Catalogue route) and files the contact; [No]. */
export async function answerContactNewCategory(pending: EraPendingSlot, text: string, chip?: string): Promise<Answer> {
  const yes = chip === "create" || (!chip && YES_RE.test(text));
  const no = chip === "no" || (!chip && NO_RE.test(text));
  if (!yes && !no) return { unmatched: true };
  if (no) return { text: "Skipped.", pending: null };

  const fail: SlotResult = { text: "Couldn't create that category.", ok: false, pending: null };
  const book = await loadContactsBook();
  if (book === "none" || !book) return fail;
  const contact = argsContact(pending);
  const wanted = tidyCategoryName(String(pending.args.category ?? ""));
  if (!wanted || !contact.id) return fail;

  // Made meanwhile (another device, the Catalogue page): use it, never a twin.
  const existing = matchCategory(book.categories, wanted);
  if (existing) return { ...(await fileContact(contact, existing)), pending: null };

  const res = await safeFetch("/api/catalogue/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module_id: book.moduleId, name: wanted }),
    timeoutMs: 8_000,
  }).catch(() => null);
  if (!res?.ok) return fail;
  const created = (await res.json().catch(() => null)) as { id?: string; name?: string } | null;
  if (!created?.id) return fail;
  const cat: CategoryRow = { id: created.id, name: created.name ?? wanted };
  const removeCategory = async () =>
    (await safeFetch(`/api/catalogue/categories/${cat.id}`, { method: "DELETE", timeoutMs: 8_000 }).catch(() => null))?.ok ??
    false;

  const r = await fileContact(contact, cat);
  if (!r.ok) {
    await removeCategory();
    return { ...r, pending: null };
  }
  return {
    ...r,
    pending: null,
    metadata: { ...r.metadata, categoryCreated: true },
    artifacts: [eraArtifact("catalogue_category", "created", cat.id, cat.name), ...(r.artifacts ?? [])],
    undo: async () => {
      const back = r.undo ? await r.undo() : true;
      const gone = await removeCategory();
      return back && gone;
    },
  };
}

/** "Which one?" (several contacts share the name) → a contact chip or its typed name. */
export async function answerContactPick(pending: EraPendingSlot, text: string, chip?: string): Promise<Answer> {
  const opt = chip
    ? pending.options.find((o) => o.value === chip)
    : pending.options.find((o) => normalizeContact(o.label) === normalizeContact(text));
  if (!opt?.value.startsWith("contact:")) return { unmatched: true };
  const book = await loadContactsBook();
  if (book === "none" || !book) return { text: FAIL_MOVE, ok: false, pending: null };
  const contact = book.contacts.find((c) => c.id === opt.value.slice("contact:".length));
  if (!contact) return { text: FAIL_MOVE, ok: false, pending: null };
  const r = await fileOrAsk(book, contact, String(pending.args.category ?? ""), pending.rawText);
  return { ...r, pending: r.pending ?? null };
}
