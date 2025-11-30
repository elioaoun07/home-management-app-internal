import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    // Validate that all updates have required fields
    for (const update of updates) {
      if (!update.id || typeof update.position !== "number") {
        return NextResponse.json(
          { error: "Each update must have id and position" },
          { status: 400 }
        );
      }
    }

    // Update each account's position
    for (const { id, position } of updates) {
      const { error } = await supabase
        .from("accounts")
        .update({ position })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating account position:", error);
        return NextResponse.json(
          { error: "Failed to update positions" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("Failed to reorder accounts:", e);
    return NextResponse.json(
      { error: "Failed to reorder accounts" },
      { status: 500 }
    );
  }
}
