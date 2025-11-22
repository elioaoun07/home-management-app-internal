import { useQuery } from "@tanstack/react-query";

export interface UserPreferences {
  theme?: "blue" | "pink";
  date_start?: string;
}

export function useUserPreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user-preferences");
      if (!res.ok) throw new Error("Failed to fetch user preferences");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour - preferences don't change often
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
