import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());

    // Test connection by attempting to get auth settings
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    console.log("Test connection - user:", user);
    console.log("Test connection - error:", error);

    // Try to list users (this will only work with service role key)
    const { data: users, error: listError } =
      await supabase.auth.admin.listUsers();

    return NextResponse.json({
      success: true,
      connectionOk: !error,
      currentUser: user,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY,
      canListUsers: !listError,
      userCount: users?.users?.length || 0,
      error: error?.message,
    });
  } catch (err) {
    console.error("Test connection error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
