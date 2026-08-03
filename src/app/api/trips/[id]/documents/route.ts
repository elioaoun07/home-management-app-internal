import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "trip-documents";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — these are photos of physical documents, not receipts
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const metaSchema = z.object({
  title: z.string().min(1).max(200),
  doc_type: z.enum(["passport", "visa", "ticket", "booking", "insurance", "other"]).default("other"),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(2000).nullish(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", id)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .order("position");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Multipart upload — mirrors POST /api/transactions/[id]/receipt: file + metadata
// in one request, storage path (never a signed URL) persisted to the DB row.
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const parsedMeta = metaSchema.safeParse({
    title: formData.get("title"),
    doc_type: formData.get("doc_type") || undefined,
    expires_on: formData.get("expires_on") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsedMeta.success) return NextResponse.json({ error: parsedMeta.error.flatten() }, { status: 400 });

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

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] ?? "jpg";
  const storagePath = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, cacheControl: "3600", upsert: false });

  if (uploadErr) {
    console.error("Trip document upload error:", uploadErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const d = parsedMeta.data;
  const { data, error } = await supabase
    .from("trip_documents")
    .insert({
      user_id: user.id,
      trip_id: id,
      title: d.title,
      doc_type: d.doc_type,
      storage_path: storagePath,
      expires_on: d.expires_on ?? null,
      notes: d.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
