"use client";

import { ChoreGroupList } from "@/components/chores/ChoreGroupList";
import { ChoreCheckInPanel } from "@/components/chores/ChoreCheckInPanel";
import { useChores } from "@/features/chores/useChores";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { subWeeks } from "date-fns";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function WebChores() {
  const tc = useThemeClasses();
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [referenceDate] = useState(() => new Date());
  const previousReferenceDate = useMemo(
    () => subWeeks(referenceDate, 1),
    [referenceDate],
  );

  const { scheduled, unscheduled, completed, periodLabel } =
    useChores(referenceDate);
  const { scheduled: previousScheduled } = useChores(previousReferenceDate);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  const totalPending = unscheduled.length + scheduled.length;
  const totalDone = completed.length;

  return (
    <div className={cn("min-h-screen", tc.pageBg)}>
      {/* Page header */}
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "w-5 h-5",
                isPink ? "text-pink-400" : "text-cyan-400",
              )}
            />
            <h1
              className={cn(
                "text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                isPink
                  ? "from-green-400 to-emerald-400"
                  : "from-green-400 to-emerald-400",
              )}
            >
              Household Chores
            </h1>
          </div>

          {/* Period label + stats */}
          <div className="flex items-center gap-3 text-sm">
            {periodLabel && (
              <span className="text-white/40 text-xs">{periodLabel}</span>
            )}
            {totalDone > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                {totalDone} done
              </span>
            )}
            {totalPending > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-medium">
                {totalPending} pending
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-white/30">
          Swipe right to complete chores as they are done.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pb-10 space-y-6">
        <ChoreCheckInPanel entries={previousScheduled} />
        <ChoreGroupList
          scheduled={scheduled}
          unscheduled={unscheduled}
          completed={completed}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
