// src/features/era/useEraHousehold.ts
// Returns the current user id + linked partner id (if any). Mirrors the
// pattern at src/features/items/useItems.ts. ERA is a Junction module, so
// every face that fetches data later will need this to honour Hard Rule #13
// (household linking by default).

"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "./queryKeys";

interface EraHousehold {
  userId: string | null;
  partnerId: string | null;
  isLinked: boolean;
}

async function fetchHousehold(): Promise<EraHousehold> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, partnerId: null, isLinked: false };

  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
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

  return { userId: user.id, partnerId, isLinked: !!partnerId };
}

export function useEraHousehold() {
  return useQuery({
    queryKey: eraKeys.household(),
    queryFn: fetchHousehold,
    staleTime: CACHE_TIMES.ACCOUNTS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
