// src/features/hub/usePartnerId.ts
// Resolves the active household partner's user_id for the current user.

import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const partnerKeys = {
  all: ["household", "partner"] as const,
};

export function usePartnerId() {
  return useQuery({
    queryKey: partnerKeys.all,
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: link } = await supabase
        .from("household_links")
        .select("owner_user_id, partner_user_id")
        .or(
          `owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`,
        )
        .eq("active", true)
        .maybeSingle();

      if (!link) return null;
      return link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
