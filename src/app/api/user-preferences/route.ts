// src/app/api/user-preferences/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("section_order, theme, date_start")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Always return keys, let client handle defaulting
  return NextResponse.json(
    data ?? { section_order: null, theme: null, date_start: null },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function PATCH(_req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { section_order, theme } = body ?? {};
  let { date_start } = (body ?? {}) as { date_start?: unknown };

  if (
    section_order !== undefined &&
    !(
      Array.isArray(section_order) &&
      section_order.every((v) => typeof v === "string")
    )
  ) {
    return NextResponse.json(
      { error: "section_order must be an array" },
      { status: 400 }
    );
  }

  // Build upsert payload with provided fields only
  const payload: Record<string, any> = { user_id: user.id };
  if (section_order !== undefined) payload.section_order = section_order;

  // Handle theme (blue/pink)
  if (theme === "blue" || theme === "pink") {
    payload.theme = theme;
  } else if (theme === null) {
    payload.theme = null;
  }

  if (
    theme === "light" ||
    theme === "dark" ||
    theme === "wood" ||
    theme === "system"
  ) {
    payload.theme = theme;
  } else if (theme === null) {
    // Explicitly clearing theme to null if client requests
    payload.theme = null;
  } else if (theme !== undefined) {
    // Ignore unknown theme strings to avoid CHECK violations on older schemas
    // (Do not write theme if it's not a recognized value)
  }
  if (date_start !== undefined) {
    // Sanitize values like "'mon-1'::text" or "'mon-1'"
    // Accept object form { week_start, month_start_day }
    if (
      typeof date_start === "object" &&
      date_start !== null &&
      (date_start as any).week_start &&
      (date_start as any).month_start_day
    ) {
      const wk = String((date_start as any).week_start).toLowerCase();
      const md = Number((date_start as any).month_start_day);
      date_start = `${wk}-${md}`;
    }
    let ds = String(date_start).trim().toLowerCase();
    const cast = ds.match(/^'(.*)'::text$/);
    if (cast) ds = cast[1];
    if (ds.startsWith("'") && ds.endsWith("'")) ds = ds.slice(1, -1);
    if (ds.startsWith('"') && ds.endsWith('"')) ds = ds.slice(1, -1);
    const m = ds.match(/^(sun|mon)-(\d{1,2})$/);
    if (!m) {
      return NextResponse.json(
        { error: "date_start must be like 'sun-1' or 'mon-6' (1..28)" },
        { status: 400 }
      );
    }
    const day = Number(m[2]);
    if (day < 1 || day > 28) {
      return NextResponse.json(
        { error: "month start day must be between 1 and 28" },
        { status: 400 }
      );
    }
    payload.date_start = `${m[1]}-${day}`;
  }

  // Update-first strategy: update existing row, else insert with safe defaults.
  const { data: existing, error: readErr } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  if (existing) {
    // UPDATE path
    const { error: updErr } = await supabase
      .from("user_preferences")
      .update(payload)
      .eq("user_id", user.id);
    if (updErr) {
      console.error("/api/user-preferences update failed", {
        payloadKeys: Object.keys(payload),
        error: updErr,
      });
      const msg = (updErr.message || "").toLowerCase();
      const maybeMissingColumn =
        msg.includes("column") &&
        (msg.includes("date_start") ||
          msg.includes("does not exist") ||
          msg.includes("42703"));
      if (
        maybeMissingColumn &&
        Object.prototype.hasOwnProperty.call(payload, "date_start")
      ) {
        const fallback = { ...payload } as any;
        delete fallback.date_start;
        const { error: updErr2 } = await supabase
          .from("user_preferences")
          .update(fallback)
          .eq("user_id", user.id);
        if (!updErr2) {
          return NextResponse.json(
            {
              success: true,
              warning: "date_start not persisted: column missing in schema",
            },
            { headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    // INSERT path — ensure a safe theme value to satisfy CHECK constraints
    const insertPayload: Record<string, any> = { ...payload };
    if (!("theme" in insertPayload) || insertPayload.theme === undefined) {
      insertPayload.theme = "system"; // allowed by your CHECK
    }
    let { error: insErr } = await supabase
      .from("user_preferences")
      .insert(insertPayload);
    if (insErr) {
      console.error("/api/user-preferences insert failed", {
        payloadKeys: Object.keys(insertPayload),
        error: insErr,
      });
      const msg = (insErr.message || "").toLowerCase();
      const maybeMissingColumn =
        msg.includes("column") &&
        (msg.includes("date_start") ||
          msg.includes("does not exist") ||
          msg.includes("42703"));
      if (
        maybeMissingColumn &&
        Object.prototype.hasOwnProperty.call(insertPayload, "date_start")
      ) {
        const fallback = { ...insertPayload } as any;
        delete fallback.date_start;
        const { error: insErr2 } = await supabase
          .from("user_preferences")
          .insert(fallback);
        if (!insErr2) {
          return NextResponse.json(
            {
              success: true,
              warning:
                "date_start not persisted: column missing in schema (insert)",
            },
            { headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { success: true },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
