// src/hooks/useHouseholdMembers.ts
// Hook to fetch and cache household members for the responsible user picker

import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface HouseholdMember {
  id: string;
  displayName: string;
  email: string | null;
  isCurrentUser: boolean;
}

export interface HouseholdMembersData {
  members: HouseholdMember[];
  currentUserId: string | null;
  householdId: string | null;
  hasPartner: boolean;
}

// Query key for household members
export const householdMembersKey = ["household-members"] as const;

async function fetchHouseholdMembers(): Promise<HouseholdMembersData> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      members: [],
      currentUserId: null,
      householdId: null,
      hasPartner: false,
    };
  }

  // Fetch household link and partner info
  const { data: link } = await supabase
    .from("household_links")
    .select(
      `
      id,
      owner_user_id,
      owner_email,
      partner_user_id,
      partner_email,
      active
    `
    )
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  // Get current user's email
  const currentUserEmail = user.email || "";

  // Always include current user as a member
  const members: HouseholdMember[] = [
    {
      id: user.id,
      displayName: "Me",
      email: currentUserEmail,
      isCurrentUser: true,
    },
  ];

  let householdId: string | null = null;
  let hasPartner = false;

  if (link) {
    householdId = link.id;
    const isOwner = link.owner_user_id === user.id;
    const partnerId = isOwner ? link.partner_user_id : link.owner_user_id;
    const partnerEmail = isOwner ? link.partner_email : link.owner_email;

    if (partnerId) {
      hasPartner = true;

      // Fetch partner's profile for display name
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("id", partnerId)
        .maybeSingle();

      const partnerDisplayName =
        partnerProfile?.display_name ||
        partnerProfile?.email?.split("@")[0] ||
        partnerEmail?.split("@")[0] ||
        "Partner";

      members.push({
        id: partnerId,
        displayName: partnerDisplayName,
        email: partnerProfile?.email || partnerEmail || null,
        isCurrentUser: false,
      });
    }
  }

  return {
    members,
    currentUserId: user.id,
    householdId,
    hasPartner,
  };
}

/**
 * Hook to fetch household members for the responsible user picker.
 * Results are cached for 10 minutes since household members rarely change.
 */
export function useHouseholdMembers() {
  return useQuery({
    queryKey: householdMembersKey,
    queryFn: fetchHouseholdMembers,
    staleTime: 1000 * 60 * 10, // 10 minutes - household members rarely change
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on window focus (stable data)
  });
}

/**
 * Get a member's display name by their ID
 */
export function getMemberDisplayName(
  members: HouseholdMember[],
  userId: string
): string {
  const member = members.find((m) => m.id === userId);
  return member?.displayName || "Unknown";
}

/**
 * Check if a user is the current user
 */
export function isCurrentUser(
  members: HouseholdMember[],
  userId: string
): boolean {
  const member = members.find((m) => m.id === userId);
  return member?.isCurrentUser ?? false;
}
