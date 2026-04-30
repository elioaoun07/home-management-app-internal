// src/lib/recycleBin/scope.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScopeIds {
  /** Current user id. */
  userId: string;
  /** All user ids whose data should be visible (self + active partner). */
  userIds: string[];
  /** Active household_link.id, if any. */
  householdId: string | null;
}

/**
 * Resolves scope for the current user. Mirrors the standard household-linking
 * pattern used elsewhere (see /api/accounts/route.ts).
 *
 * @param ownOnly when true, only the current user's data is in scope.
 */
export async function resolveScope(
  supabase: SupabaseClient,
  userId: string,
  ownOnly: boolean,
): Promise<ScopeIds> {
  const { data: link } = await supabase
    .from("household_links")
    .select("id, owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const partnerId = link
    ? link.owner_user_id === userId
      ? link.partner_user_id
      : link.owner_user_id
    : null;

  const userIds =
    !ownOnly && partnerId ? [userId, partnerId as string] : [userId];

  return {
    userId,
    userIds,
    householdId: link?.id ?? null,
  };
}
