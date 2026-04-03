import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ email: z.string().email() });

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

  // Accept form or JSON
  const ct = req.headers.get("content-type") ?? "";
  let email = "";
  if (ct.includes("application/json")) {
    email = BodySchema.parse(await req.json()).email;
  } else {
    const form = await req.formData();
    email = BodySchema.parse({ email: String(form.get("email") || "") }).email;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const redirectTo = `${site}/reset-password/update`; // absolute URL
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.redirect(
      `${site}/reset-password?error=${encodeURIComponent(error.message)}`,
      { status: 302 },
    );
  }

  return NextResponse.redirect(`${site}/reset-password?sent=1`, {
    status: 302,
  });
}
