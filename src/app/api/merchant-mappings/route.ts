// src/app/api/merchant-mappings/route.ts
import { getActiveHouseholdPartnerId } from "@/lib/accountAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CategoryEmbed = { slug: string | null; name: string | null } | null;

type MappingRow = {
  id: string;
  user_id: string;
  merchant_pattern: string;
  use_count: number | null;
  [key: string]: unknown;
  category: CategoryEmbed;
  subcategory: CategoryEmbed;
};

// GET merchant mappings.
// Default: the user's own mappings (Merchant Mappings manager, statement import).
// ?household=true additionally includes the active household partner's mappings
// so learned merchants work across users; rows are enriched with the mapped
// category/subcategory slug+name so clients can resolve them against ANY
// account's category list (cross-account matching is by slug/name — the
// Categories module's canonical cross-user pattern). Reads use the admin
// client after household verification, mirroring /api/categories.
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeHousehold = req.nextUrl.searchParams.get("household") === "true";

  try {
    const userIds = [user.id];
    if (includeHousehold) {
      const partnerId = await getActiveHouseholdPartnerId(supabase, user.id);
      if (partnerId) userIds.push(partnerId);
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("merchant_mappings")
      .select(
        "*, category:user_categories!merchant_mappings_category_id_fkey(slug,name), subcategory:user_categories!merchant_mappings_subcategory_id_fkey(slug,name)",
      )
      .in("user_id", userIds)
      .order("use_count", { ascending: false });

    if (error) throw error;

    const flattened = ((data || []) as MappingRow[]).map((m) => {
      const { category, subcategory, ...rest } = m;
      return {
        ...rest,
        category_slug: category?.slug ?? null,
        category_name: category?.name ?? null,
        subcategory_slug: subcategory?.slug ?? null,
        subcategory_name: subcategory?.name ?? null,
      };
    });

    // Own mappings outrank the partner's for the same pattern; within an owner,
    // higher use_count first (match tie-breaks resolve to the first row).
    flattened.sort((a, b) => {
      const ownA = a.user_id === user.id ? 0 : 1;
      const ownB = b.user_id === user.id ? 0 : 1;
      if (ownA !== ownB) return ownA - ownB;
      return (b.use_count ?? 0) - (a.use_count ?? 0);
    });
    const seen = new Set<string>();
    const deduped = flattened.filter((m) => {
      const key = m.merchant_pattern.toUpperCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduped);
  } catch (error) {
    console.error("Failed to fetch merchant mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch merchant mappings" },
      { status: 500 },
    );
  }
}

// POST - create or update a merchant mapping
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      merchant_pattern,
      merchant_name,
      category_id,
      subcategory_id,
      account_id,
    } = body;

    if (!merchant_pattern || !merchant_name) {
      return NextResponse.json(
        { error: "merchant_pattern and merchant_name are required" },
        { status: 400 }
      );
    }

    // Upsert - if pattern exists, update it; otherwise create new
    const { data, error } = await supabase
      .from("merchant_mappings")
      .upsert(
        {
          user_id: user.id,
          merchant_pattern: merchant_pattern.toUpperCase().trim(),
          merchant_name: merchant_name.trim(),
          category_id: category_id || null,
          subcategory_id: subcategory_id || null,
          account_id: account_id || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,merchant_pattern",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to save merchant mapping:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json({ error: "Merchant mapping already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to save merchant mapping" },
      { status: 500 }
    );
  }
}

// DELETE - remove a merchant mapping
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("merchant_mappings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete merchant mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete merchant mapping" },
      { status: 500 }
    );
  }
}
