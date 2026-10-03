"use client";

import ChoresView from "@/components/chores/ChoresView";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

// Desktop Chores tab: same view as /chores, inside the web shell's header.
export default function WebChores({ initialDate }: { initialDate?: string }) {
  const tc = useThemeClasses();
  return (
    <div className={cn("min-h-full", tc.pageBg)}>
      <ChoresView variant="web" initialDate={initialDate} />
    </div>
  );
}
