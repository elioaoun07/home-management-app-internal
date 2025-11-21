import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let email: string | undefined;
    let password: string | undefined;
    let name: string | undefined;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      email = body.email;
      password = body.password;
      name = body.name;
    } else {
      const form = await req.formData();
      email = form.get("email") as string | undefined;
      password = form.get("password") as string | undefined;
      name = form.get("name") as string | undefined;
    }

    if (!email || !password || !name) {
      return NextResponse.redirect(
        new URL("/signup?error=missing", req.url),
        303
      );
    }

    const supabase = await supabaseServer(await cookies());

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          name,
        },
      },
    } as any);

    if (error) {
      console.error("Signup error:", {
        message: error.message,
        status: error.status,
        email,
      });
      // Provide user-friendly error message
      const errorMsg = error.message.includes("already registered")
        ? "email_exists"
        : "signup_failed";
      return NextResponse.redirect(
        new URL(`/signup?error=${errorMsg}`, req.url),
        303
      );
    }

    // If the user is created and session is available (auto-confirm), also update profile name
    try {
      const userId = data.user?.id;
      if (userId) {
        const { error: updErr } = await supabase.auth.updateUser({
          data: { full_name: name, name },
        } as any);
        if (updErr) console.warn("Post-signup updateUser warning:", updErr);
      }
    } catch (e) {
      // Non-fatal, metadata is already set on signUp options
    }

    // Redirect to login with a success message (Supabase may send confirmation email)
    return NextResponse.redirect(new URL(`/login?info=signup`, req.url), 303);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(
      new URL("/signup?error=internal", req.url),
      303
    );
  }
}
