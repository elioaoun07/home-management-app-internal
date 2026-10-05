// Tickets / QR confirmations attached to a place (many per place). Files go to the
// private `trip-documents` bucket; only storage paths are persisted on the row.
import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "trip-documents";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Ctx = { params: Promise<{ id: string; placeId: string }> };

async function authorize(id: string, placeId: string) {
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const { data: place } = await supabase
    .from("trip_places")
    .select("id, attachment_paths")
    .eq("id", placeId)
    .eq("trip_id", id)
    .maybeSingle();
  if (!place) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  return { supabase, user, paths: (place as { attachment_paths: string[] | null }).attachment_paths ?? [] };
}

async function savePaths(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  id: string,
  placeId: string,
  paths: string[],
) {
  return supabase
    .from("trip_places")
    .update({ attachment_paths: paths, updated_at: new Date().toISOString() })
    .eq("id", placeId)
    .eq("trip_id", id)
    .select()
    .single();
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, placeId } = await params;
  const auth = await authorize(id, placeId);
  if (auth.error) return auth.error;
  const { supabase, user, paths } = auth;

  if (paths.length >= MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} attachments` }, { status: 400 });
  }

  const file = (await req.formData()).get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const admin = supabaseAdmin();
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] ?? "jpg";
  const storagePath = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    console.error("Place attachment upload error:", uploadErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data, error } = await savePaths(supabase, id, placeId, [...paths, storagePath]);
  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE ?path=<storage path> removes one attachment.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, placeId } = await params;
  const auth = await authorize(id, placeId);
  if (auth.error) return auth.error;
  const { supabase, paths } = auth;

  const target = req.nextUrl.searchParams.get("path");
  if (!target || !paths.includes(target)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await savePaths(supabase, id, placeId, paths.filter((p) => p !== target));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin().storage.from(BUCKET).remove([target]);
  return new NextResponse(null, { status: 204 });
}
