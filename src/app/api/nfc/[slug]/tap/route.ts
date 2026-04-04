import { findAndActivateTriggeredItems } from "@/lib/prerequisites/engine";
import { supabaseServer } from "@/lib/supabase/server";
import type { NfcChecklistItemWithStatus } from "@/types/nfc";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST /api/nfc/[slug]/tap — record a tap, flip state, evaluate prerequisites
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: allow overriding the auto-flip with a specific target state
  const schema = z
    .object({
      target_state: z.string().min(1).max(50).optional(),
    })
    .optional();

  let targetStateOverride: string | undefined;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (parsed.success && parsed.data?.target_state) {
      targetStateOverride = parsed.data.target_state;
    }
  } catch {
    // Empty body is fine — use auto-flip
  }

  // Household linking — allow tapping partner's tags
  let userIds: string[] = [user.id];
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const partnerId = link
    ? link.owner_user_id === user.id
      ? link.partner_user_id
      : link.owner_user_id
    : null;
  if (partnerId) userIds = [user.id, partnerId];

  // Fetch tag (owner or household partner)
  const { data: tag, error: tagError } = await supabase
    .from("nfc_tags")
    .select("*")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 });
  }
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (!tag.is_active) {
    return NextResponse.json({ error: "Tag is disabled" }, { status: 403 });
  }

  const states: string[] = tag.states ?? [];
  if (states.length < 2) {
    return NextResponse.json(
      { error: "Tag must have at least 2 states" },
      { status: 400 },
    );
  }

  // Compute next state: auto-flip or override
  const previousState: string | null = tag.current_state;
  let newState: string;

  if (targetStateOverride) {
    if (!states.includes(targetStateOverride)) {
      return NextResponse.json(
        {
          error: `Invalid state: ${targetStateOverride}. Valid: ${states.join(", ")}`,
        },
        { status: 400 },
      );
    }
    newState = targetStateOverride;
  } else {
    // Auto-flip: advance to next state in the cycle
    const currentIndex = previousState ? states.indexOf(previousState) : -1;
    newState = states[(currentIndex + 1) % states.length];
  }

  // Update tag current_state
  const { error: updateError } = await supabase
    .from("nfc_tags")
    .update({
      current_state: newState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tag.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log state change and get the log ID for checklist completions
  const { data: stateLog, error: logError } = await supabase
    .from("nfc_state_log")
    .insert({
      tag_id: tag.id,
      previous_state: previousState,
      new_state: newState,
      changed_by: user.id,
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to log NFC state change:", logError);
    // Non-fatal but we need the ID, so return a fallback
  }

  const stateLogId = stateLog?.id ?? null;

  // Evaluate prerequisites: find dormant items triggered by this NFC state change
  const triggeredItems = await findAndActivateTriggeredItems(
    { type: "nfc_state_change", tag_id: tag.id, new_state: newState },
    supabase,
    user.id,
  );

  // Fetch checklist items for the new state from nfc_checklist_items table
  const { data: checklistRows } = await supabase
    .from("nfc_checklist_items")
    .select(
      "*, source_tag:nfc_tags!nfc_checklist_items_source_tag_id_fkey(label, current_state)",
    )
    .eq("tag_id", tag.id)
    .eq("state", newState)
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  // Build enriched checklist items with cross-tag auto-completion
  const checklistItems: NfcChecklistItemWithStatus[] = (
    checklistRows ?? []
  ).map((row) => {
    const sourceTag = row.source_tag as {
      label: string;
      current_state: string | null;
    } | null;
    const isAutoCompleted =
      !!row.source_tag_id &&
      !!row.source_state &&
      sourceTag?.current_state === row.source_state;

    return {
      id: row.id,
      tag_id: row.tag_id,
      state: row.state,
      title: row.title,
      order_index: row.order_index,
      source_tag_id: row.source_tag_id,
      source_state: row.source_state,
      is_active: row.is_active,
      created_at: row.created_at,
      source_tag_label: sourceTag?.label ?? null,
      source_tag_current_state: sourceTag?.current_state ?? null,
      is_completed: isAutoCompleted,
      is_auto_completed: isAutoCompleted,
      completed_by: null,
      completed_at: null,
    };
  });

  // Fetch recent activity (last 10 state transitions)
  const { data: recentActivity } = await supabase
    .from("nfc_state_log")
    .select("*")
    .eq("tag_id", tag.id)
    .order("changed_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    tag: { ...tag, current_state: newState },
    previous_state: previousState,
    new_state: newState,
    state_log_id: stateLogId,
    triggered_items: triggeredItems,
    checklist_items: checklistItems,
    recent_activity: recentActivity ?? [],
  });
}
