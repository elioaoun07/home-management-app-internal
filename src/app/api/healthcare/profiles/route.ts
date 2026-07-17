import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  is_self: z.boolean().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  blood_type: z.enum(bloodTypes).nullish(),
  notes: z.string().max(2000).nullish(),
  shared_with_household: z.boolean().optional(),
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
    const parsed = createProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { is_self, ...fields } = parsed.data;

    const { data, error } = await supabase
      .from("health_profiles")
      .insert({
        ...fields,
        managing_user_id: user.id,
        // user_id may only ever be the session user — a profile can't claim
        // to be someone else's account.
        user_id: is_self ? user.id : null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Profile already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { profile: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}
