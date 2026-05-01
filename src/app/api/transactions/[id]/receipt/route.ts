import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "receipts";
const MAX_BYTES = 500 * 1024; // 500 KB hard ceiling (client already compresses to ~80 KB)

// POST /api/transactions/[id]/receipt — upload or replace receipt
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

  // Confirm ownership
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, user_id, receipt_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;
  if (!imageFile) return NextResponse.json({ error: "No image provided" }, { status: 400 });
  if (imageFile.size > MAX_BYTES)
    return NextResponse.json({ error: "Image too large (max 500 KB after compression)" }, { status: 400 });

  const admin = supabaseAdmin();

  // Ensure bucket exists
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

  const storagePath = `${user.id}/${id}.jpg`;
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  // Upsert so replacing an existing receipt works
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Receipt upload error:", uploadErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Store the storage path (not a signed URL) so it never expires
  const { error: updateErr } = await supabase
    .from("transactions")
    .update({ receipt_url: storagePath })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ receipt_url: storagePath });
}

// DELETE /api/transactions/[id]/receipt — remove receipt
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

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, user_id, receipt_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (tx.receipt_url) {
    const admin = supabaseAdmin();
    await admin.storage.from(BUCKET).remove([tx.receipt_url]);
  }

  await supabase
    .from("transactions")
    .update({ receipt_url: null })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
