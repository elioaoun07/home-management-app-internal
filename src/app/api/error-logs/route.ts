import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { error_message, error_stack, component_name, user_agent, url } = body;

    // Insert error log
    const { error } = await supabase.from("error_logs").insert({
      user_id: user?.id || null,
      error_message: error_message?.substring(0, 1000) || "Unknown error",
      error_stack: error_stack?.substring(0, 5000) || null,
      component_name: component_name?.substring(0, 200) || null,
      user_agent: user_agent?.substring(0, 500) || null,
      url: url?.substring(0, 500) || null,
    });

    if (error) {
      console.error("Failed to log error:", error);
      return NextResponse.json(
        { error: "Failed to log error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error logging endpoint failed:", err);
    return NextResponse.json(
      { error: "Logging failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent error logs
    const { data, error } = await supabase
      .from("error_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    console.error("Error fetching logs:", err);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
