import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      );
    }

    // Update each transaction
    const results = await Promise.all(
      updates.map(async ({ id, ...data }) => {
        const { error } = await supabase
          .from("transactions")
          .update(data)
          .eq("id", id)
          .eq("user_id", user.id); // RLS check

        if (error) throw error;
        return { id, success: true };
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to update transactions" },
      { status: 500 }
    );
  }
}
