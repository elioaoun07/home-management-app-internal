import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/receipts/signed-url?path=receipts%2F{userId}%2F{txId}.jpg
// Validates that the first path segment matches the requesting user, then
// generates a signed URL using the admin client (bypasses Storage RLS).
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath)
    return NextResponse.json({ error: "Missing path" }, { status: 400 });

  // Path is always receipts/{userId}/{txId}.jpg — first segment must be the caller's id
  const segments = storagePath.split("/");
  if (segments[0] !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .storage.from("receipts")
    .createSignedUrl(storagePath, 60 * 60); // 1-hour URL

  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl });
}
