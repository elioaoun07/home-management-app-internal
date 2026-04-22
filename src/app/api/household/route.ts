import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function extractDisplayName(authUser: any): string | null {
  const meta = authUser?.user_metadata ?? {};
  return (
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    null
  );
}

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: link, error } = await supabase
    .from("household_links")
    .select(
      "id, code, owner_user_id, owner_email, partner_user_id, partner_email, active, created_at"
    )
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (!link) return NextResponse.json({ link: null });

  const admin = supabaseAdmin();

  const [ownerRes, partnerRes] = await Promise.all([
    admin.auth.admin.getUserById(link.owner_user_id),
    link.partner_user_id
      ? admin.auth.admin.getUserById(link.partner_user_id)
      : Promise.resolve({ data: { user: null }, error: null }),
  ]);

  const enriched = {
    ...link,
    owner_name: extractDisplayName(ownerRes.data.user) ?? link.owner_email,
    partner_name: link.partner_user_id
      ? (extractDisplayName(partnerRes.data.user) ?? link.partner_email)
      : null,
  };

  return NextResponse.json(
    { link: enriched },
    { headers: { "Cache-Control": "no-store" } }
  );
}
