import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Support both form submissions and JSON fetches
    let username: string | undefined;
    let password: string | undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        username?: string;
        password?: string;
      };
      username = body.username;
      password = body.password;
    } else {
      const form = await req.formData();
      username = form.get("username") as string | undefined;
      password = form.get("password") as string | undefined;
    }

    if (!username || !password) {
      console.log("Login attempt with missing credentials");
      // Redirect back to login with error
      return NextResponse.redirect(
        new URL("/login?error=missing", req.url),
        303
      );
    }

    console.log("Attempting login for email:", username);
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

    const supabase = await supabaseServer(await cookies());

    // Use Supabase server client to sign in and set cookies
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error) {
      console.error("Supabase sign-in error:", {
        error: error.message,
        code: error.status,
        name: error.name,
        email: username,
        fullError: JSON.stringify(error),
      });

      // Return more specific error message
      const errorMessage = error.message.includes("Email not confirmed")
        ? "not_confirmed"
        : error.message.includes("Invalid login credentials")
          ? "invalid"
          : "internal";

      return NextResponse.redirect(
        new URL(`/login?error=${errorMessage}`, req.url),
        303
      );
    }

    if (!data.session) {
      console.error("No session returned from Supabase");
      return NextResponse.redirect(
        new URL("/login?error=invalid", req.url),
        303
      );
    }

    console.log("Login successful for:", username);

    // On success the @supabase/ssr client will have set cookies; redirect to /expense
    return NextResponse.redirect(new URL("/expense", req.url), 303);
  } catch (err) {
    console.error("Login error", err);
    return NextResponse.redirect(
      new URL("/login?error=internal", req.url),
      303
    );
  }
}
