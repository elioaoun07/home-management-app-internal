// src/hooks/useHouseholdPartner.ts
//
// The household partner's id and display name, from `/api/household`.
//
// Why not `useHouseholdMembers`: that hook reads `profiles` from the browser,
// and `profiles` is a MIRROR of `auth.users` metadata that can be empty (it was
// on the owner's account — BUD-47), in which case every name degrades to an
// email prefix. `/api/household` resolves the name server-side through
// `supabaseAdmin().auth.admin.getUserById()`, which is the authoritative
// source, and falls back to the email only when there genuinely is no name.
//
// Kept separate rather than folded into `useHouseholdMembers` so this does not
// change behaviour for the four other features that already depend on that
// hook's exact shape.

import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";

export interface HouseholdPartner {
  id: string;
  /** Real name when one is set, otherwise the email (never an empty string). */
  displayName: string;
}

export const householdPartnerKey = ["household-partner"] as const;

export function useHouseholdPartner(currentUserId?: string) {
  return useQuery<HouseholdPartner | null>({
    queryKey: [...householdPartnerKey, currentUserId ?? null],
    enabled: !!currentUserId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await safeFetch("/api/household", { timeoutMs: 10_000 });
      if (!res.ok) return null;
      const data = await res.json();
      const link = data?.link;
      if (!link) return null;

      const isOwner = link.owner_user_id === currentUserId;
      const id = isOwner ? link.partner_user_id : link.owner_user_id;
      if (!id) return null;

      const name = isOwner
        ? (link.partner_name ?? link.partner_email)
        : (link.owner_name ?? link.owner_email);
      return { id, displayName: name || "Partner" };
    },
  });
}
