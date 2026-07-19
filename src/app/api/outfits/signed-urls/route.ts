// Batch signed-URL endpoint — kills the per-image request fan-out on grids.
// Every path's first segment MUST be the caller's user id (no household branch — locked D4).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "wardrobe";
const EXPIRES_IN = 3600; // 1 h — client caches for 50 min (useSignedUrls.ts)

const bodySchema = z.object({
  paths: z.array(z.string().min(1).max(300)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const paths = [...new Set(parsed.data.paths)];
    for (const p of paths) {
      if (p.split("/")[0] !== user.id) {
        return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin()
      .storage.from(BUCKET)
      .createSignedUrls(paths, EXPIRES_IN);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const urls: Record<string, string> = {};
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
    }

    return NextResponse.json({ urls }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to sign URLs" }, { status: 500 });
  }
}
