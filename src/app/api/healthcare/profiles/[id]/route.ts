import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  blood_type: z.enum(bloodTypes).nullish(),
  notes: z.string().max(2000).nullish(),
  shared_with_household: z.boolean().optional(),
});

// PATCH /api/healthcare/profiles/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parsed = updateProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // RLS restricts writes to managing_user_id = auth.uid(); a miss is a 404.
    const { data, error } = await supabase
      .from("health_profiles")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json(
      { profile: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

// DELETE /api/healthcare/profiles/[id] — soft delete (deleted_at); child rows
// stay in place so an Undo (restore = clear deleted_at) brings everything back.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const restore = req.nextUrl.searchParams.get("restore") === "true";

  const { data, error } = await supabase
    .from("health_profiles")
    .update({
      deleted_at: restore ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json(
    { profile: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
