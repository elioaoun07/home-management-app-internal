import { deriveDefaultKeywords } from "@/lib/health/allergenMatch";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createAllergySchema = z.object({
  profile_id: z.string().uuid(),
  allergen: z.string().trim().min(1).max(80),
  severity: z.enum(["mild", "moderate", "severe", "anaphylaxis"]).optional(),
  reaction_notes: z.string().max(2000).nullish(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createAllergySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { keywords, ...fields } = parsed.data;

    // managing_user_id is set by the DB trigger from the parent profile; RLS
    // WITH CHECK then rejects inserts against profiles the user doesn't manage.
    const { data, error } = await supabase
      .from("health_allergies")
      .insert({
        ...fields,
        managing_user_id: user.id,
        keywords: keywords?.length ? keywords : deriveDefaultKeywords(fields.allergen),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Allergy already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { allergy: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create allergy" }, { status: 500 });
  }
}
