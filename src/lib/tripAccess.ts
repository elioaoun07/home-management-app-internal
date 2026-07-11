import { getActiveHouseholdPartnerId } from "@/lib/accountAccess";
import type { Trip } from "@/types/trips";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = Pick<SupabaseClient, "from">;

export type AccessibleTrip = {
  trip: Trip;
  isOwner: boolean;
};

/**
 * A trip is accessible to its owner always, and to the active household
 * partner only when scope === "household" — solo trips stay private.
 * Places/packing on an accessible trip are collaboratively read+write
 * (mirrors the is_public account pattern); the trip record itself
 * (edit/activate/complete/delete) stays owner-only — gate on `isOwner`
 * separately for those routes.
 */
export async function getAccessibleTrip(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
): Promise<AccessibleTrip | null> {
  const { data: trip, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (error || !trip) return null;

  if (trip.user_id === userId) {
    return { trip, isOwner: true };
  }

  if (trip.scope !== "household") return null;

  const partnerId = await getActiveHouseholdPartnerId(supabase, userId);
  if (!partnerId || trip.user_id !== partnerId) return null;

  return { trip, isOwner: false };
}
