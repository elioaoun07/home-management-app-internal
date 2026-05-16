import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/catalogue/document-image/signed-url?path={userId}/{itemId}.{ext}
// Validates caller is the owner or their active household partner.
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath)
    return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const segments = storagePath.split("/");
  if (segments.length < 2)
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const ownerId = segments[0];

  if (ownerId !== user.id) {
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .maybeSingle();

    const isPartner =
      link &&
      ((link.owner_user_id === user.id && link.partner_user_id === ownerId) ||
        (link.partner_user_id === user.id && link.owner_user_id === ownerId));

    if (!isPartner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin()
    .storage.from("documents")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl });
}
