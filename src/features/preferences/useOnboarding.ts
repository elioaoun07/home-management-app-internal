import { useQuery } from "@tanstack/react-query";

export interface OnboardingStatus {
  completed: boolean;
}

export function useOnboarding() {
  return useQuery<OnboardingStatus>({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - onboarding status rarely changes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
