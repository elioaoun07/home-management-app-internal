// src/app/api/catalogue/modules/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueModule, CreateModuleInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const settingsSchema = z.record(z.string(), z.unknown()).optional();

// GET all modules for the current user
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is a partner in a household (they share modules with owner)
  const { data: householdAsPartner } = await supabase
    .from("household_links")
    .select("id")
    .eq("partner_user_id", user.id)
    .eq("active", true)
    .limit(1)
    .single();

  // Only initialize default modules if user has none AND is not a household partner
  // (Partners share modules with the owner, so they don't need their own)
  if (!householdAsPartner) {
    const { count } = await supabase
      .from("catalogue_modules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count === 0) {
      // Initialize default modules
      await supabase.rpc("initialize_catalogue_modules", {
        p_user_id: user.id,
      });
    }
  }

  // Fetch modules with item counts - RLS handles visibility (own + partner's public)
  const { data: modules, error } = await supabase
    .from("catalogue_modules")
    .select(
      `
      *,
      categories:catalogue_categories(count),
      items:catalogue_items(count)
    `,
    )
    .eq("is_enabled", true)
    // Counts exclude binned/archived items (they inflated every module card).
    .is("items.deleted_at", null)
    .is("items.archived_at", null)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching catalogue modules:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform counts
  const modulesWithCounts = modules.map((m) => ({
    ...m,
    category_count: m.categories?.[0]?.count ?? 0,
    item_count: m.items?.[0]?.count ?? 0,
    categories: undefined,
    items: undefined,
  }));

  return NextResponse.json(modulesWithCounts as CatalogueModule[], {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new custom module
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateModuleInput;
    const {
      type,
      name,
      description,
      icon,
      color,
      gradient_from,
      gradient_to,
      is_public,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Module name is required" },
        { status: 400 },
      );
    }

    // HUB-94 — ERA marks the modules it creates (`{ era_role: "places" }`).
    const settings = settingsSchema.safeParse(body.settings_json);
    if (!settings.success) {
      return NextResponse.json(
        { error: "settings_json must be an object" },
        { status: 400 },
      );
    }

    // Get max position
    const { data: maxPos } = await supabase
      .from("catalogue_modules")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPos?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("catalogue_modules")
      .insert({
        user_id: user.id,
        type: type || "custom",
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || "folder",
        color: color || "#3b82f6",
        gradient_from: gradient_from || color || "#3b82f6",
        gradient_to: gradient_to || color || "#2563eb",
        is_system: false,
        is_enabled: true,
        is_public: is_public ?? true,
        position: nextPosition,
        ...(settings.data ? { settings_json: settings.data } : {}),
      })
      .select()
      .single();

    if (error) {
      // (user_id, type, name) and the per-user ERA role are unique.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A module with that name already exists" },
          { status: 409 },
        );
      }
      console.error("Error creating module:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(created as CatalogueModule, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
