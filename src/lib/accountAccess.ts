import type { AccountType } from "@/types/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACCOUNT_SELECT =
  "id,user_id,name,type,is_default,inserted_at,country_code,location_name,position,visible,is_public,account_balances(balance_set_at)";

export type AccessibleAccount = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  is_default?: boolean | null;
  inserted_at?: string;
  country_code?: string | null;
  location_name?: string | null;
  position?: number | null;
  visible?: boolean | null;
  is_public?: boolean | null;
  isOwner: boolean;
  canRead: boolean;
  canWrite: boolean;
};

type SupabaseLike = Pick<SupabaseClient, "from">;

/**
 * Shared accounts are normally public-only. A household transfer is the one
 * deliberate exception: its destination picker includes every visible partner
 * account, so the API must be able to authorize that specific destination.
 */
export function isPartnerAccountAccessible(
  account: Pick<AccessibleAccount, "visible" | "is_public">,
  options: { allowPrivatePartner?: boolean } = {},
): boolean {
  return (
    account.visible !== false &&
    (account.is_public === true || options.allowPrivatePartner === true)
  );
}

export async function getActiveHouseholdPartnerId(
  supabase: SupabaseLike,
  userId: string,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link) return null;
  return link.owner_user_id === userId
    ? link.partner_user_id
    : link.owner_user_id;
}

export async function getAccessibleAccount(
  supabase: SupabaseLike,
  userId: string,
  accountId: string,
  options: { includeHidden?: boolean; allowPrivatePartner?: boolean } = {},
): Promise<AccessibleAccount | null> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", accountId)
    .maybeSingle();

  if (error || !account) return null;

  const isOwner = account.user_id === userId;
  if (isOwner) {
    if (!options.includeHidden && account.visible === false) return null;
    return {
      ...account,
      isOwner: true,
      canRead: true,
      canWrite: true,
    };
  }

  if (!isPartnerAccountAccessible(account, options)) return null;

  const partnerId = await getActiveHouseholdPartnerId(supabase, userId);
  if (!partnerId || account.user_id !== partnerId) return null;

  return {
    ...account,
    isOwner: false,
    canRead: true,
    canWrite: true,
  };
}
