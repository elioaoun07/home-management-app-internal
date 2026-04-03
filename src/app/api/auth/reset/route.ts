import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const FormSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

function getBaseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const site = getBaseUrl(req);
  const ct = req.headers.get("content-type") ?? "";

  // Accept form or JSON
  let raw: Record<string, unknown> = {};
  if (ct.includes("application/json")) {
    raw = await req.json();
  } else {
    const form = await req.formData();
    raw = {
      password: form.get("password") ? String(form.get("password")) : "",
      confirm: form.get("confirm") ? String(form.get("confirm")) : undefined,
      access_token: form.get("access_token")
        ? String(form.get("access_token"))
        : undefined,
      refresh_token: form.get("refresh_token")
        ? String(form.get("refresh_token"))
        : undefined,
    };
  }

  const data = FormSchema.parse(raw);
  if (data.confirm && data.password !== data.confirm) {
    return NextResponse.redirect(
      `${site}/reset-password/update?error=${encodeURIComponent("Passwords do not match")}`,
      { status: 302 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // If tokens from the hash were posted, set a session first
  if (data.access_token && data.refresh_token) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (setErr) {
      return NextResponse.redirect(
        `${site}/reset-password/update?error=${encodeURIComponent(setErr.message)}`,
        { status: 302 },
      );
    }
  }

  // Now update the password
  const { error: updErr } = await supabase.auth.updateUser({
    password: data.password,
  });
  if (updErr) {
    return NextResponse.redirect(
      `${site}/reset-password/update?error=${encodeURIComponent(updErr.message)}`,
      { status: 302 },
    );
  }

  return NextResponse.redirect(`${site}/login?reset=1`, { status: 302 });
}
