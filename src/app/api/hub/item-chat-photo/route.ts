import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "receipts";
const MAX_BYTES = 500 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;
  if (!imageFile)
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  if (imageFile.size > MAX_BYTES)
    return NextResponse.json(
      { error: "Image too large (max 500 KB)" },
      { status: 400 },
    );

  const admin = supabaseAdmin();

  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  }

  const storagePath = `item-chat/${user.id}/${Date.now()}.jpg`;
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Signed URL valid for 1 year
  const { data: signedData, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signErr || !signedData) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
