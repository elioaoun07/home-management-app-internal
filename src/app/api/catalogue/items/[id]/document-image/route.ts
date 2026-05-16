import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "documents";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    .from("catalogue_items")
    .select("id, user_id, image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;
  if (!imageFile) return NextResponse.json({ error: "No image provided" }, { status: 400 });
  if (imageFile.size > MAX_BYTES)
    return NextResponse.json({ error: "Image too large (max 5 MB)" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      return NextResponse.json({ error: "Storage init failed" }, { status: 500 });
    }
  }

  const mimeType = imageFile.type || "image/jpeg";
  const ext =
    mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  const storagePath = `${user.id}/${id}.${ext}`;
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  // Remove old file if extension changed
  if (item.image_url && item.image_url !== storagePath) {
    await admin.storage.from(BUCKET).remove([item.image_url]);
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("catalogue_items")
    .update({ image_url: storagePath })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ image_url: storagePath });
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
    .from("catalogue_items")
    .select("id, user_id, image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.image_url) {
    await supabaseAdmin().storage.from(BUCKET).remove([item.image_url]);
  }

  await supabase
    .from("catalogue_items")
    .update({ image_url: null })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
