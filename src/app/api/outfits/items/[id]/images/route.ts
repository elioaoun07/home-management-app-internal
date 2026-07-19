// Garment image upload/delete: multipart original + cutout WebP → private
// `wardrobe` bucket, storage PATHS stored on the row (never URLs/base64).
// Cloned from the catalogue document-image route, household branch dropped (locked D4).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "wardrobe";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per file — client compresses to ~150 KB
const ALLOWED_TYPES = ["image/webp", "image/png", "image/jpeg"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: item } = await supabase
    .from("wardrobe_items")
    .select("id, image_path, cutout_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 });

  const formData = await req.formData();
  const original = formData.get("original") as File | null;
  const cutout = formData.get("cutout") as File | null;
  if (!original && !cutout) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }
  for (const [label, file] of [
    ["original", original],
    ["cutout", cutout],
  ] as const) {
    if (!file) continue;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `${label} too large (max 2 MB)` }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `${label} must be webp/png/jpeg` }, { status: 400 });
    }
  }

  const admin = supabaseAdmin();

  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      return NextResponse.json({ error: "Storage init failed" }, { status: 500 });
    }
  }

  const uploaded: string[] = [];
  const update: Record<string, string> = {};

  for (const [field, file, filename] of [
    ["image_path", original, "original.webp"],
    ["cutout_path", cutout, "cutout.webp"],
  ] as const) {
    if (!file) continue;
    const storagePath = `${user.id}/${id}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "image/webp",
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadErr) {
      if (uploaded.length > 0) await admin.storage.from(BUCKET).remove(uploaded);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    uploaded.push(storagePath);
    update[field] = storagePath;
  }

  const { error: updateErr } = await supabase
    .from("wardrobe_items")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    await admin.storage.from(BUCKET).remove(uploaded);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json(update, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: item } = await supabase
    .from("wardrobe_items")
    .select("id, image_path, cutout_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 });

  const paths = [item.image_path, item.cutout_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (paths.length > 0) {
    await supabaseAdmin().storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("wardrobe_items")
    .update({ image_path: null, cutout_path: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
