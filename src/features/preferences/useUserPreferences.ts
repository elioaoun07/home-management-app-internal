import {
  CACHE_TIMES,
  getCachedPreferences,
  setCachedPreferences,
} from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";

export interface UserPreferences {
  theme?: "blue" | "pink";
  date_start?: string;
}

export function useUserPreferences() {
  // Get cached preferences for instant display
  const cachedPrefs = getCachedPreferences();

  return useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user-preferences");
      if (!res.ok) throw new Error("Failed to fetch user preferences");
      const data = await res.json();
      // Cache to localStorage for instant next load
      setCachedPreferences(data);
      return data;
    },
    // OPTIMIZED: 1 hour stale time, use localStorage for instant load
    staleTime: CACHE_TIMES.PREFERENCES,
    refetchOnMount: false, // Don't refetch on mount - use cache
    refetchOnWindowFocus: false, // Preferences don't change externally
    // Use cached prefs as initial data for instant UI
    initialData: cachedPrefs
      ? {
          date_start: cachedPrefs.date_start,
          theme: cachedPrefs.theme as "blue" | "pink" | undefined,
        }
      : undefined,
  });
}
