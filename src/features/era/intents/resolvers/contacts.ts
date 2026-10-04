// src/features/era/intents/resolvers/contacts.ts
// HUB-89 — "add Laura as a contact". Source-owned adapter over the routes the
// Catalogue contacts module already uses: GET /api/catalogue/modules (find the
// `contacts` module), POST /api/catalogue/items. Inverse: DELETE
// /api/catalogue/items/[id] (soft → Recycle Bin).

import { safeFetch } from "@/lib/safeFetch";
import { routeWrite, type RouteWriteResult } from "./routeWrite";

export async function resolveAddContact(name: string): Promise<RouteWriteResult> {
  const clean = name.trim();
  if (!clean) return { text: "Add who?", ok: false };
  try {
    const modRes = await safeFetch("/api/catalogue/modules", { timeoutMs: 8_000 });
    if (!modRes.ok) return { text: "Couldn't add that.", ok: false };
    const modules = (await modRes.json()) as Array<{ id: string; type?: string }>;
    const contacts = Array.isArray(modules) ? modules.find((m) => m.type === "contacts") : undefined;
    if (!contacts) return { text: "No contacts module.", ok: false };

    return routeWrite({
      call: { url: "/api/catalogue/items", method: "POST", body: { module_id: contacts.id, name: clean } },
      pickId: (json) => (json as { id?: string } | null)?.id,
      artifact: { entity: "contact", action: "created", title: clean },
      inverse: (id) => ({ url: `/api/catalogue/items/${id}`, method: "DELETE" }),
      reply: `Added · ${clean}`,
      failReply: "Couldn't add that.",
      idKey: "contactId",
      extraMetadata: { moduleId: contacts.id },
    });
  } catch {
    return { text: "Couldn't add that.", ok: false };
  }
}
