import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "trip-documents";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  doc_type: z.enum(["passport", "visa", "ticket", "booking", "insurance", "other"]).optional(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(2000).nullish(),
  position: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("trip_documents")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", docId)
    .eq("trip_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: doc } = await supabase
    .from("trip_documents")
    .select("storage_path")
    .eq("id", docId)
    .eq("trip_id", id)
    .single();

  if (doc?.storage_path) {
    await supabaseAdmin().storage.from(BUCKET).remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from("trip_documents")
    .delete()
    .eq("id", docId)
    .eq("trip_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
