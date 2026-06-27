import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
} from "@/constants/defaultCategories";
import {
  ACCOUNT_SELECT,
  getActiveHouseholdPartnerId,
} from "@/lib/accountAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic"; // disable caching

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["expense", "income", "saving"]),
  country_code: z.string().trim().min(1).max(2).optional(),
  location_name: z.string().trim().min(1).max(120).optional(),
  with_default_categories: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

async function fetchAccountList(
  supabase: any,
  userId: string,
  options: { ownOnly: boolean; includeHidden: boolean; allHousehold?: boolean },
) {
  let ownQuery = supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("user_id", userId);

  if (!options.includeHidden) {
    ownQuery = ownQuery.neq("visible", false);
  }

  const { data: ownAccounts, error: ownError } = await ownQuery;
  if (ownError) throw ownError;

  let partnerAccounts: any[] = [];
  if (!options.ownOnly) {
    const partnerId = await getActiveHouseholdPartnerId(supabase, userId);
    if (partnerId) {
      let partnerQuery = supabase
        .from("accounts")
        .select(ACCOUNT_SELECT)
        .eq("user_id", partnerId)
        .neq("visible", false);
      // Without allHousehold, only expose partner's explicitly shared accounts
      // (used by the expense-form account picker).
      if (!options.allHousehold) {
        partnerQuery = partnerQuery.eq("is_public", true);
      }
      const { data, error } = await partnerQuery;
      if (error) throw error;
      partnerAccounts = data ?? [];
    }
  }

  // PostgREST returns the embedded account_balances as an OBJECT (1:1, since
  // account_id is unique) when a row exists, or null when none does — not an array.
  const flatten = (a: any) => {
    const ab = a.account_balances;
    const balance_set_at = Array.isArray(ab)
      ? (ab[0]?.balance_set_at ?? null)
      : (ab?.balance_set_at ?? null);
    return { ...a, balance_set_at, account_balances: undefined };
  };

  return [...(ownAccounts ?? []), ...partnerAccounts]
    .sort((a, b) => {
      const positionDiff = (a.position ?? 0) - (b.position ?? 0);
      if (positionDiff !== 0) return positionDiff;
      return (
        new Date(b.inserted_at ?? 0).getTime() -
        new Date(a.inserted_at ?? 0).getTime()
      );
    })
    .map(flatten);
}

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
  // Check if we should include hidden accounts (for edit mode)
  const includeHidden =
    req.nextUrl.searchParams.get("includeHidden") === "true";
  // Dashboard uses ?household=true to get all partner accounts regardless of is_public.
  // The expense-form account picker omits this flag so only partner's public accounts show.
  const allHousehold = req.nextUrl.searchParams.get("household") === "true";

  let data: any[] = [];
  try {
    data = await fetchAccountList(supabase, user.id, {
      ownOnly,
      includeHidden,
      allHousehold,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if current user has any accounts (partner might have accounts but we need to seed for new users)
  const currentUserAccounts = (data || []).filter(
    (a) => a.user_id === user.id && a.visible !== false,
  );

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
          .select(ACCOUNT_SELECT)
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

        // Ensure balance row exists for this account
        await supabase
          .from("account_balances")
          .upsert({ account_id: accountId, user_id: user.id, balance: 0 }, { onConflict: "account_id", ignoreDuplicates: true });

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

      // Re-read accounts after seeding (include partner public accounts too)
      const seeded = await fetchAccountList(supabase, user.id, {
        ownOnly,
        includeHidden: false,
      });
      return NextResponse.json(seeded ?? [], {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to seed default data" },
        { status: 500 },
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
    const parsed = createAccountSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const {
      name,
      type: typeNorm,
      country_code,
      location_name,
      with_default_categories,
      is_public,
    } = parsed.data;

    // Determine if we should seed default categories and which ones
    // - Expense accounts: seed expense categories (DEFAULT_CATEGORIES)
    // - Income/Saving accounts: seed income categories (from DEFAULT_ACCOUNTS)
    // Can be explicitly set to false to skip seeding
    const shouldSeedCategories = with_default_categories !== false;

    // Get income categories from DEFAULT_ACCOUNTS for income/saving account types
    const incomeAccountSeed = DEFAULT_ACCOUNTS.find((a) => a.type === "Income");
    const incomeCategories = incomeAccountSeed?.categories || [];

    // Choose which categories to seed based on account type
    const categoriesToSeed =
      typeNorm === "expense" ? DEFAULT_CATEGORIES : incomeCategories;

    const insertData: Record<string, any> = {
      user_id: user.id,
      name,
      type: typeNorm,
      is_public: is_public ?? false,
    };

    // Add optional country fields if provided
    if (country_code) {
      insertData.country_code = country_code.toUpperCase();
    }
    if (location_name) {
      insertData.location_name = location_name;
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert(insertData)
      .select(ACCOUNT_SELECT)
      .single();

    if (error) {
      // 👍 handle unique violation
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { error: "Account name already exists" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Seed default categories for the new account (only if requested)
    if (data?.id && shouldSeedCategories && categoriesToSeed.length > 0) {
      try {
        let categoryPosition = 0;
        for (const cat of categoriesToSeed) {
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
      } catch {
        // Don't fail the account creation, categories can be added manually
      }
    }

    // Create the initial balance row (required for adjustAccountBalance to work)
    if (data?.id) {
      await supabase
        .from("account_balances")
        .insert({ account_id: data.id, user_id: user.id, balance: 0 });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
