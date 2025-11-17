import { DEFAULT_ACCOUNTS } from "@/constants/defaultCategories";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // disable caching

export async function GET(_req: NextRequest) {
  // Use SSR client bound to request cookies to identify the logged-in user
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,user_id,name,type,is_default,inserted_at")
    .eq("user_id", user.id)
    .order("inserted_at", { ascending: false });

  if (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If no accounts exist for this user, seed defaults (persist to DB) and return them
  if (!data || data.length === 0) {
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
              icon: cat.icon,
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
                  icon: sub.icon,
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

      // Re-read accounts after seeding and return
      const { data: seeded, error: seededErr } = await supabase
        .from("accounts")
        .select("id,user_id,name,type,inserted_at")
        .eq("user_id", user.id)
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
    const { name, type } = body || {};

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

    const { data, error } = await supabase
      .from("accounts")
      .insert({ user_id: user.id, name: String(name).trim(), type: typeNorm })
      .select("id,user_id,name,type,inserted_at")
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
