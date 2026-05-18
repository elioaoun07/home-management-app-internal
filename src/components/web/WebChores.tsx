"use client";

import { ChoreGroupList } from "@/components/chores/ChoreGroupList";
import { useChores } from "@/features/chores/useChores";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { useUpdateItem } from "@/features/items/useItems";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function WebChores() {
  const tc = useThemeClasses();
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [referenceDate] = useState(() => new Date());

  const { scheduled, unscheduled, completed, periodLabel } =
    useChores(referenceDate);
  const updateItem = useUpdateItem();

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  const handleTransferPartner = useCallback(
    async (entry: FlexibleRoutineItem) => {
      if (!currentUserId) return;
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: link } = await supabase
        .from("household_links")
        .select("owner_user_id, partner_user_id")
        .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .eq("active", true)
        .single();

      if (!link) return;
      const partnerId =
        link.owner_user_id === user.id ? link.partner_user_id : link.owner_user_id;
      if (!partnerId) return;

      updateItem.mutate({ id: entry.id, responsible_user_id: partnerId });
    },
    [currentUserId, updateItem],
  );

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
          Swipe right to complete · tap ✓ for quick done · long-press for more
          options
        </p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        <ChoreGroupList
          scheduled={scheduled}
          unscheduled={unscheduled}
          completed={completed}
          periodStart={new Date()}
          currentUserId={currentUserId}
          onTransferPartner={handleTransferPartner}
        />
      </div>
    </div>
  );
}
