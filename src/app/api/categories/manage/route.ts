import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/categories/manage
 * Comprehensive endpoint for category management operations
 */
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
    const { operation, data } = body;

    switch (operation) {
      case "create":
        return await createCategory(supabase, user.id, data);
      case "update":
        return await updateCategory(supabase, user.id, data);
      case "delete":
        return await deleteCategory(supabase, user.id, data);
      case "reorder":
        return await reorderCategories(supabase, user.id, data);
      case "bulk_update":
        return await bulkUpdateCategories(supabase, user.id, data);
      default:
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Category management error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createCategory(
  supabase: any,
  userId: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    account_id: string;
    parent_id?: string | null;
    position?: number;
  }
) {
  const { name, icon, color, account_id, parent_id, position } = data;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Category name is required" },
      { status: 400 }
    );
  }

  if (!account_id) {
    return NextResponse.json(
      { error: "Account ID is required" },
      { status: 400 }
    );
  }

  // Get max position for this account/parent combination
  let maxPosition = 0;
  const { data: existingCategories } = await supabase
    .from("user_categories")
    .select("position")
    .eq("user_id", userId)
    .eq("account_id", account_id)
    .is("parent_id", parent_id || null)
    .order("position", { ascending: false })
    .limit(1);

  if (existingCategories && existingCategories.length > 0) {
    maxPosition = existingCategories[0].position;
  }

  const { data: category, error } = await supabase
    .from("user_categories")
    .insert({
      user_id: userId,
      name: name.trim(),
      icon: icon || "📁",
      color: color || "#38bdf8",
      account_id,
      parent_id: parent_id || null,
      position: position ?? maxPosition + 1,
      visible: true,
    })
    .select("id,name,color,parent_id,position,visible,account_id")
    .single();

  if (error) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }

  return NextResponse.json(category, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function updateCategory(
  supabase: any,
  userId: string,
  data: {
    id: string;
    name?: string;
    color?: string;
    visible?: boolean;
    position?: number;
  }
) {
  const { id, name, color, visible, position } = data;

  if (!id) {
    return NextResponse.json(
      { error: "Category ID is required" },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined && name.trim()) updates.name = name.trim();
  if (color !== undefined) updates.color = color;
  if (visible !== undefined) updates.visible = visible;
  if (position !== undefined) updates.position = position;

  const { data: category, error } = await supabase
    .from("user_categories")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id,name,color,parent_id,position,visible,account_id")
    .single();

  if (error) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }

  return NextResponse.json(category, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function deleteCategory(
  supabase: any,
  userId: string,
  data: { id: string; hard_delete?: boolean }
) {
  const { id, hard_delete = false } = data;

  if (!id) {
    return NextResponse.json(
      { error: "Category ID is required" },
      { status: 400 }
    );
  }

  // Check if category has subcategories
  const { data: subcategories } = await supabase
    .from("user_categories")
    .select("id")
    .eq("parent_id", id)
    .eq("user_id", userId);

  if (subcategories && subcategories.length > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete category with subcategories. Delete subcategories first.",
      },
      { status: 400 }
    );
  }

  if (hard_delete) {
    // Hard delete - remove from database
    const { error } = await supabase
      .from("user_categories")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Hard delete category error:", error);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }
  } else {
    // Soft delete - mark as invisible
    const { error } = await supabase
      .from("user_categories")
      .update({ visible: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Soft delete category error:", error);
      return NextResponse.json(
        { error: "Failed to hide category" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: true, message: "Category deleted successfully" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function reorderCategories(
  supabase: any,
  userId: string,
  data: {
    account_id: string;
    parent_id?: string | null;
    categories: Array<{ id: string; position: number }>;
  }
) {
  const { account_id, parent_id, categories } = data;

  if (!account_id || !categories || categories.length === 0) {
    return NextResponse.json(
      { error: "Invalid reorder data" },
      { status: 400 }
    );
  }

  // Update positions for all categories in batch
  const updates = categories.map((cat) =>
    supabase
      .from("user_categories")
      .update({ position: cat.position, updated_at: new Date().toISOString() })
      .eq("id", cat.id)
      .eq("user_id", userId)
      .eq("account_id", account_id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    console.error("Reorder categories error:", errors);
    return NextResponse.json(
      { error: "Failed to reorder some categories" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Categories reordered successfully" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function bulkUpdateCategories(
  supabase: any,
  userId: string,
  data: {
    updates: Array<{
      id: string;
      name?: string;
      icon?: string;
      color?: string;
      position?: number;
      visible?: boolean;
    }>;
  }
) {
  const { updates } = data;

  if (!updates || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updatePromises = updates.map((update) => {
    const { id, ...fields } = update;
    return supabase
      .from("user_categories")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id,name,color,parent_id,position,visible,account_id")
      .single();
  });

  const results = await Promise.all(updatePromises);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    console.error("Bulk update categories error:", errors);
    return NextResponse.json(
      { error: `Failed to update ${errors.length} categories` },
      { status: 500 }
    );
  }

  const updatedCategories = results.map((r) => r.data).filter(Boolean);

  return NextResponse.json(
    { success: true, categories: updatedCategories },
    { headers: { "Cache-Control": "no-store" } }
  );
}
