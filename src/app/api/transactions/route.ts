import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const limit = parseInt(searchParams.get("limit") || "200");

    // Determine if user has a household link to include partner transactions
    const { data: link } = await supabase
      .from("household_links")
      .select(
        "owner_user_id, owner_email, partner_user_id, partner_email, active"
      )
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

    // Build query with proper joins
    let query = supabase
      .from("transactions")
      .select(
        `id, date, category_id, subcategory_id, amount, description, account_id, inserted_at, user_id, is_private,
        category:user_categories!transactions_category_fk(name, icon),
        subcategory:user_categories!transactions_subcategory_fk(name)`
      )
      .order("inserted_at", { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (start) query = query.gte("date", start);
    if (end) query = query.lte("date", end);

    // Filter by user + partner if household linked
    if (partnerId) {
      query = query.in("user_id", [user.id, partnerId]);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data: rawRows, error } = (await query) as any;

    if (error) {
      console.error("Failed to fetch transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Fetch account names for all account IDs (including partner's accounts)
    const accountIds = [
      ...new Set((rawRows || []).map((r: any) => r.account_id).filter(Boolean)),
    ];
    let accountNamesMap: Record<string, string> = {};

    if (accountIds.length > 0) {
      // Fetch accounts for current user
      const { data: myAccounts } = await supabase
        .from("accounts")
        .select("id, name")
        .in("id", accountIds);

      if (myAccounts) {
        myAccounts.forEach((acc: any) => {
          accountNamesMap[acc.id] = acc.name;
        });
      }

      // If household linked, fetch partner's account names
      if (partnerId) {
        const { data: partnerAccounts } = await supabase
          .from("accounts")
          .select("id, name")
          .eq("user_id", partnerId)
          .in("id", accountIds);

        if (partnerAccounts) {
          partnerAccounts.forEach((acc: any) => {
            accountNamesMap[acc.id] = acc.name;
          });
        }
      }
    }

    // Fetch category names for partner's categories
    const categoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.category_id).filter(Boolean)
      ),
    ];
    const subcategoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.subcategory_id).filter(Boolean)
      ),
    ];
    let categoryNamesMap: Record<string, { name: string; icon?: string }> = {};

    if (categoryIds.length > 0 || subcategoryIds.length > 0) {
      const allCatIds = [...categoryIds, ...subcategoryIds];

      // Fetch categories for current user
      const { data: myCategories } = await supabase
        .from("user_categories")
        .select("id, name, icon")
        .in("id", allCatIds);

      if (myCategories) {
        myCategories.forEach((cat: any) => {
          categoryNamesMap[cat.id] = { name: cat.name, icon: cat.icon };
        });
      }

      // If household linked, fetch partner's category names
      if (partnerId) {
        const { data: partnerCategories } = await supabase
          .from("user_categories")
          .select("id, name, icon")
          .eq("user_id", partnerId)
          .in("id", allCatIds);

        if (partnerCategories) {
          partnerCategories.forEach((cat: any) => {
            categoryNamesMap[cat.id] = { name: cat.name, icon: cat.icon };
          });
        }
      }
    }

    if (error) {
      console.error("Failed to fetch transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Filter out private transactions from partner's view
    const filteredRows = (rawRows || []).filter((r: any) => {
      // If it's the user's own transaction, show it (even if private)
      if (r.user_id === user.id) return true;
      // If it's partner's transaction and it's private, hide it
      if (r.is_private === true) return false;
      return true;
    });

    // Fetch user theme preferences for color coding
    const { data: myPrefs } = await supabase
      .from("user_preferences")
      .select("theme")
      .eq("user_id", user.id)
      .maybeSingle();

    let partnerTheme: string | null = null;
    if (partnerId) {
      const { data: partnerPrefs } = await supabase
        .from("user_preferences")
        .select("theme")
        .eq("user_id", partnerId)
        .maybeSingle();
      partnerTheme = partnerPrefs?.theme || null;
    }

    // Compute display names for household
    const meMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const meName =
      (meMeta.full_name as string | undefined) ||
      (meMeta.name as string | undefined) ||
      "Me";

    let partnerName: string | undefined = undefined;
    if (partnerId && link) {
      const partnerEmail =
        link.owner_user_id === partnerId
          ? (link.owner_email as string | undefined)
          : (link.partner_email as string | undefined);
      if (partnerEmail) {
        const emailName = partnerEmail.split("@")[0].replace(/[._-]/g, " ");
        partnerName = emailName
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      } else {
        partnerName = "Partner";
      }
    }

    const transactions = (filteredRows || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      category:
        categoryNamesMap[r.category_id]?.name || r.category?.name || null,
      subcategory:
        categoryNamesMap[r.subcategory_id]?.name || r.subcategory?.name || null,
      amount: r.amount,
      description: r.description,
      account_id: r.account_id,
      category_id: r.category_id,
      subcategory_id: r.subcategory_id,
      inserted_at: r.inserted_at,
      user_id: r.user_id,
      user_name: r.user_id === user.id ? meName : partnerName || "Partner",
      account_name: accountNamesMap[r.account_id] || "Unknown",
      category_icon:
        categoryNamesMap[r.category_id]?.icon || r.category?.icon || "📝",
      is_private: r.is_private || false,
      is_owner: r.user_id === user.id,
      user_theme:
        r.user_id === user.id
          ? myPrefs?.theme || "blue"
          : // Reverse theme for partner: if I'm blue, partner is pink; if I'm pink, partner is blue
            myPrefs?.theme === "pink"
            ? "blue"
            : "pink",
    }));

    return NextResponse.json(transactions, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest) {
  // Use SSR client to access the authenticated user via cookies
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await _req.json();
    const {
      account_id,
      category_id,
      subcategory_id,
      amount,
      description,
      date,
      is_private,
    } = body;

    // Validate required fields
    if (!account_id || !category_id || !amount) {
      return NextResponse.json(
        { error: "account_id, category_id, and amount are required" },
        { status: 400 }
      );
    }

    // Get category name from category_id
    const { data: categoryData, error: categoryError } = await supabase
      .from("user_categories")
      .select("name")
      .eq("id", category_id)
      .eq("user_id", user.id)
      .single();

    if (categoryError) {
      console.error("Error fetching category:", categoryError);
      return NextResponse.json(
        { error: "Invalid category_id" },
        { status: 400 }
      );
    }

    // Get subcategory name if provided
    let subcategoryName = "";
    if (subcategory_id) {
      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from("user_categories")
        .select("name")
        .eq("id", subcategory_id)
        .eq("user_id", user.id)
        .single();

      if (subcategoryError) {
        console.error("Error fetching subcategory:", subcategoryError);
        return NextResponse.json(
          { error: "Invalid subcategory_id" },
          { status: 400 }
        );
      }
      subcategoryName = subcategoryData.name;
    }

    // Determine date: accept optional YYYY-MM-DD, default to today
    let txDate: string;
    if (typeof date === "string") {
      const valid =
        /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
      txDate = valid ? date : new Date().toISOString().split("T")[0];
    } else {
      txDate = new Date().toISOString().split("T")[0];
    }

    // Create transaction
    const transactionData = {
      user_id: user.id,
      date: txDate, // YYYY-MM-DD
      category_id: category_id,
      subcategory_id: subcategory_id || null,
      amount: parseFloat(amount),
      description: description || "",
      account_id: account_id,
      is_private: is_private || false,
      // inserted_at is handled by the database default
    };

    console.log("[/api/transactions] Creating transaction:", transactionData);

    const { data, error } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Failed to create transaction:", err);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, date, amount, description, category_id, subcategory_id } =
      body || {};
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateFields: Record<string, any> = {};

    if (date !== undefined) {
      // Expect YYYY-MM-DD
      const d = typeof date === "string" ? date : String(date);
      // Quick validation: 10 chars and valid Date
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid date format (expected YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      updateFields.date = d;
    }

    if (amount !== undefined) {
      const num = typeof amount === "number" ? amount : Number(amount);
      if (!Number.isFinite(num)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      updateFields.amount = num;
    }

    if (description !== undefined) {
      updateFields.description = description ?? "";
    }

    // Handle category/subcategory updates by resolving names. Accept both UUIDs and default seed IDs.
    const isUuid = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        v
      );

    // Helper to resolve a category name by id which may be a UUID or a default seed id.
    const resolveCategoryName = async (idOrSeed: string) => {
      if (isUuid(idOrSeed)) {
        const { data, error } = await supabase
          .from("user_categories")
          .select("name")
          .eq("id", idOrSeed)
          .eq("user_id", user.id)
          .single();
        if (error || !data) return null;
        return data.name as string;
      }
      // For seed ids, attempt to find matching name from DEFAULT_ACCOUNTS
      try {
        const { DEFAULT_ACCOUNTS } = await import(
          "@/constants/defaultCategories"
        );
        for (const acc of DEFAULT_ACCOUNTS) {
          for (const cat of acc.categories) {
            if (cat.id === idOrSeed) return cat.name;
            for (const sub of cat.subcategories ?? []) {
              if (sub.id === idOrSeed) return sub.name;
            }
          }
        }
      } catch {}
      return null;
    };

    if (category_id !== undefined) {
      if (category_id === null || category_id === "") {
        updateFields.category_id = null;
        // When clearing category, also clear subcategory if not explicitly set
        if (subcategory_id === undefined) updateFields.subcategory_id = null;
      } else {
        updateFields.category_id = String(category_id);
        // If category changes and subcategory not provided, clear subcategory as it may no longer be valid
        if (subcategory_id === undefined) updateFields.subcategory_id = null;
      }
    }

    if (subcategory_id !== undefined) {
      if (subcategory_id === null || subcategory_id === "") {
        updateFields.subcategory_id = null;
      } else {
        updateFields.subcategory_id = String(subcategory_id);
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating transaction:", error);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Failed to update transaction:", e);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
