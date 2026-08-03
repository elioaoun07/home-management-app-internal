// Batch signed-URL endpoint for trip documents — mirrors POST /api/outfits/signed-urls.
import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "trip-documents";
const EXPIRES_IN = 3600; // 1h — client caches for 50 min

const bodySchema = z.object({
  paths: z.array(z.string().min(1).max(300)).min(1).max(100),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Paths must belong to this trip — prevents signing an arbitrary path outside it.
  const paths = [...new Set(parsed.data.paths)];
  for (const p of paths) {
    const segments = p.split("/");
    if (segments[1] !== id) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, EXPIRES_IN);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
  }

  return NextResponse.json({ urls }, { headers: { "Cache-Control": "no-store" } });
}
