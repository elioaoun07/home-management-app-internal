// src/app/api/guest-portal/admin/orders/route.ts
// Host view of every guest's drink and allergy submission for one portal tag.
// Authenticated: the public guest routes only ever return a guest's own row.
//
// The guest_* tables are service-role-only (RLS on without policies, or off),
// so identity comes from the session client and the rows from the admin
// client — but only after the caller is proven to be the tag's host (or the
// host's active household partner). The ownership check below is the control.
import { getActiveHouseholdPartnerId } from "@/lib/accountAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({ tag_id: z.string().uuid().optional() });

const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: HEADERS });

interface TagRow {
  id: string;
  user_id: string;
  tag_slug: string;
  label: string | null;
}

const TAG_COLUMNS = "id, user_id, tag_slug, label";

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const parsed = querySchema.safeParse({
    tag_id: request.nextUrl.searchParams.get("tag_id") ?? undefined,
  });
  if (!parsed.success) return json({ error: "Invalid tag_id" }, 400);

  try {
    const partnerId = await getActiveHouseholdPartnerId(supabase, user.id);
    const hostIds = partnerId ? [user.id, partnerId] : [user.id];
    const db = supabaseAdmin();

    let tag: TagRow | null;
    if (parsed.data.tag_id) {
      const { data } = await db
        .from("guest_portal_tags")
        .select(TAG_COLUMNS)
        .eq("id", parsed.data.tag_id)
        .maybeSingle();
      tag = (data as TagRow | null) ?? null;
      if (!tag) return json({ error: "Portal not found" }, 404);
      if (!hostIds.includes(tag.user_id)) {
        return json({ error: "Forbidden" }, 403);
      }
    } else {
      // No tag given: the host's own portal, preferring "home".
      const { data } = await db
        .from("guest_portal_tags")
        .select(TAG_COLUMNS)
        .in("user_id", hostIds)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      const own = (data as TagRow[] | null) ?? [];
      tag = own.find((t) => t.tag_slug === "home") ?? own[0] ?? null;
      if (!tag) return json({ error: "Portal not found" }, 404);
    }

    const [drinks, allergies] = await Promise.all([
      db
        .from("guest_drinks")
        .select("*")
        .eq("tag_id", tag.id)
        .order("created_at", { ascending: false }),
      db
        .from("guest_allergies")
        .select("*")
        .eq("tag_id", tag.id)
        .order("created_at", { ascending: false }),
    ]);

    if (drinks.error || allergies.error) {
      console.error(
        "[GuestAdmin] Fetch error:",
        drinks.error ?? allergies.error,
      );
      return json({ error: "Failed to fetch guest orders" }, 500);
    }

    return json({
      tag: { id: tag.id, slug: tag.tag_slug, label: tag.label },
      drinks: drinks.data ?? [],
      allergies: allergies.data ?? [],
    });
  } catch (err) {
    console.error("[GuestAdmin] GET error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
