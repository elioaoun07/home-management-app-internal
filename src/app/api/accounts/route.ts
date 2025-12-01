import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
} from "@/constants/defaultCategories";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // disable caching

export async function GET(req: NextRequest) {
  // Use SSR client bound to request cookies to identify the logged-in user
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if we should only return the current user's accounts (for add transaction form)
  const ownOnly = req.nextUrl.searchParams.get("own") === "true";

  let userIds: string[] = [user.id];

  // Only fetch partner accounts if not requesting own accounts only
  if (!ownOnly) {
    // Check for household link to also fetch partner's accounts
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id, active")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const partnerId = link
      ? link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id
      : null;

    // Fetch accounts for current user AND partner (if linked)
    if (partnerId) {
      userIds = [user.id, partnerId];
    }
  }

  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id,user_id,name,type,is_default,inserted_at,country_code,location_name,position"
    )
    .in("user_id", userIds)
    .order("position", { ascending: true })
    .order("inserted_at", { ascending: false });

  if (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if current user has any accounts (partner might have accounts but we need to seed for new users)
  const currentUserAccounts = (data || []).filter((a) => a.user_id === user.id);

  // If no accounts exist for the CURRENT USER, seed defaults (persist to DB) and return them
  if (currentUserAccounts.length === 0) {
    try {
      for (const seed of DEFAULT_ACCOUNTS) {
        const typeNorm = seed.type.toLowerCase() as "income" | "expense";

        // Insert account; on unique conflict, fetch the existing id
        let accountId: string | null = null;
        const { data: acc, error: accErr } = await supabase
          .from("accounts")
          .insert({ user_id: user.id, name: seed.name, type: typeNorm })
          .select("id,user_id,name,type,inserted_at")
          .single();

        if (accErr) {
          if ((accErr as any).code === "23505") {
            const { data: existing } = await supabase
              .from("accounts")
              .select("id")
              .eq("user_id", user.id)
              .eq("name", seed.name)
              .limit(1)
              .maybeSingle();
            accountId = existing?.id ?? null;
          } else {
            throw accErr;
          }
        } else {
          accountId = acc?.id ?? null;
        }

        if (!accountId)
          throw new Error("Failed to create or resolve account id");

        // Insert root categories and their subcategories for this account
        for (const cat of seed.categories) {
          const { data: root, error: rootErr } = await supabase
            .from("user_categories")
            .insert({
              user_id: user.id,
              account_id: accountId,
              name: cat.name,
              color: cat.color,
              parent_id: null,
              position: cat.position ?? null,
              visible: cat.visible ?? true,
            })
            .select("id")
            .single();
          if (rootErr) throw rootErr;

          if (Array.isArray(cat.subcategories) && root?.id) {
            for (const sub of cat.subcategories) {
              const { error: subErr } = await supabase
                .from("user_categories")
                .insert({
                  user_id: user.id,
                  account_id: accountId,
                  name: sub.name,
                  color: sub.color,
                  parent_id: root.id,
                  position: sub.position ?? null,
                  visible: sub.visible ?? true,
                });
              if (subErr) throw subErr;
            }
          }
        }
      }

      // Re-read accounts after seeding (include partner's accounts too)
      const { data: seeded, error: seededErr } = await supabase
        .from("accounts")
        .select(
          "id,user_id,name,type,is_default,inserted_at,country_code,location_name,position"
        )
        .in("user_id", userIds)
        .order("position", { ascending: true })
        .order("inserted_at", { ascending: false });
      if (seededErr) throw seededErr;
      return NextResponse.json(seeded ?? [], {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (e) {
      console.error("Seeding default accounts/categories failed:", e);
      return NextResponse.json(
        { error: "Failed to seed default data" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  // Create a new account for the authenticated user
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, type, country_code, location_name } = body || {};

    if (!name || !type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    // Optional: constrain type to known values
    const typeNorm = String(type).toLowerCase();
    if (!["expense", "income"].includes(typeNorm)) {
      return NextResponse.json(
        { error: "type must be 'expense' or 'income'" },
        { status: 400 }
      );
    }

    const insertData: Record<string, any> = {
      user_id: user.id,
      name: String(name).trim(),
      type: typeNorm,
    };

    // Add optional country fields if provided
    if (country_code) {
      insertData.country_code = String(country_code).toUpperCase().trim();
    }
    if (location_name) {
      insertData.location_name = String(location_name).trim();
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert(insertData)
      .select("id,user_id,name,type,inserted_at,country_code,location_name")
      .single();

    if (error) {
      // 👍 handle unique violation
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { error: "Account name already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Seed default categories for the new account
    if (data?.id) {
      try {
        let categoryPosition = 0;
        for (const cat of DEFAULT_CATEGORIES) {
          categoryPosition++;
          const { data: root, error: rootErr } = await supabase
            .from("user_categories")
            .insert({
              user_id: user.id,
              account_id: data.id,
              name: cat.name,
              color: cat.color,
              parent_id: null,
              position: cat.position ?? categoryPosition,
              visible: true,
            })
            .select("id")
            .single();

          if (rootErr) {
            console.error("Error seeding root category:", rootErr);
            continue; // Don't fail account creation if category seeding fails
          }

          // Seed subcategories
          if (Array.isArray(cat.subcategories) && root?.id) {
            let subPosition = 0;
            for (const sub of cat.subcategories) {
              subPosition++;
              await supabase.from("user_categories").insert({
                user_id: user.id,
                account_id: data.id,
                name: sub.name,
                color: sub.color,
                parent_id: root.id,
                position: sub.position ?? subPosition,
                visible: true,
              });
            }
          }
        }
      } catch (seedError) {
        console.error("Error seeding categories for new account:", seedError);
        // Don't fail the account creation, categories can be added manually
      }
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Failed to create account:", e);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
