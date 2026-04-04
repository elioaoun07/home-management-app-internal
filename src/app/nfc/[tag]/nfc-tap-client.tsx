"use client";

import {
  useNfcTag,
  useNfcTap,
  useToggleChecklistCompletion,
} from "@/features/nfc/hooks";
import { safeFetch } from "@/lib/safeFetch";
import type {
  NfcChecklistItemWithStatus,
  NfcStateLog,
  NfcTapResult,
  TriggeredItem,
} from "@/types/nfc";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  Home,
  Link2,
  Loader2,
  RotateCcw,
  ShieldOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface NfcTapClientProps {
  tagSlug: string;
  displayName: string;
}

type Phase =
  | "loading"
  | "disabled"
  | "confirm"
  | "arriving"
  | "leaving"
  | "error";

export default function NfcTapClient({
  tagSlug,
  displayName,
}: NfcTapClientProps) {
  const router = useRouter();
  const {
    data: tag,
    isLoading: tagLoading,
    error: tagError,
  } = useNfcTag(tagSlug);
  const tapMutation = useNfcTap(tagSlug);

  const [phase, setPhase] = useState<Phase>("loading");
  const [nextState, setNextState] = useState<string | null>(null);
  const [tapResult, setTapResult] = useState<NfcTapResult | null>(null);
  const [autoConfirmTimer, setAutoConfirmTimer] = useState(3);
  const [subtaskStates, setSubtaskStates] = useState<Record<string, boolean>>(
    {},
  );
  const [checklistStates, setChecklistStates] = useState<
    Record<string, boolean>
  >({});
  const [hasInitialized, setHasInitialized] = useState(false);
  const tapInFlightRef = useRef(false);

  const completionMutation = useToggleChecklistCompletion(tagSlug);

  // Compute next state when tag data arrives — only once on initial load
  useEffect(() => {
    if (!tag || hasInitialized) return;
    if (!tag.is_active) {
      setPhase("disabled");
      setHasInitialized(true);
      return;
    }
    const states: string[] = tag.states ?? [];
    if (states.length < 2) {
      setPhase("error");
      setHasInitialized(true);
      return;
    }
    const currentIndex = tag.current_state
      ? states.indexOf(tag.current_state)
      : -1;
    const computed = states[(currentIndex + 1) % states.length];
    setNextState(computed);
    setPhase("confirm");
    setHasInitialized(true);
  }, [tag, hasInitialized]);

  // Auto-confirm countdown
  useEffect(() => {
    if (phase !== "confirm") return;
    if (autoConfirmTimer <= 0) {
      handleTap();
      return;
    }
    const timer = setTimeout(() => setAutoConfirmTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoConfirmTimer]);

  const handleTap = useCallback(
    async (overrideState?: string) => {
      const stateToUse = overrideState ?? nextState;
      if (!stateToUse || tapInFlightRef.current) return;

      tapInFlightRef.current = true;

      try {
        const result = await tapMutation.mutateAsync(stateToUse);
        setTapResult(result);

        // Initialize subtask states (from triggered items)
        const states: Record<string, boolean> = {};
        for (const item of result.triggered_items) {
          for (const sub of item.subtasks) {
            states[sub.id] = !!sub.done_at;
          }
        }
        setSubtaskStates(states);

        // Initialize checklist states from tap result (auto-completed items pre-checked)
        const clStates: Record<string, boolean> = {};
        for (const cl of result.checklist_items ?? []) {
          clStates[cl.id] = cl.is_completed;
        }
        setChecklistStates(clStates);

        // Route to appropriate phase
        const hasChecklist = (result.checklist_items ?? []).length > 0;
        const hasTriggered = result.triggered_items.length > 0;

        if (hasChecklist || hasTriggered) {
          setPhase("leaving"); // checklist phase
        } else if (stateToUse === "arriving") {
          setPhase("arriving");
        } else {
          setPhase("arriving"); // simple confirmation for states without checklist
        }
      } catch {
        setPhase("error");
      } finally {
        tapInFlightRef.current = false;
      }
    },
    [nextState, tapMutation],
  );

  const handleOverride = useCallback(
    (state: string) => {
      setAutoConfirmTimer(-1); // Cancel auto-confirm
      setNextState(state);
      handleTap(state);
    },
    [handleTap],
  );

  const toggleSubtask = useCallback(
    async (subtaskId: string, done: boolean) => {
      setSubtaskStates((prev) => ({ ...prev, [subtaskId]: done }));
      try {
        await safeFetch(`/api/items/subtasks/${subtaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            done_at: done ? new Date().toISOString() : null,
          }),
        });
      } catch {
        // Revert on failure
        setSubtaskStates((prev) => ({ ...prev, [subtaskId]: !done }));
      }
    },
    [],
  );

  const toggleChecklist = useCallback(
    async (itemId: string, done: boolean) => {
      // Optimistic update
      setChecklistStates((prev) => ({ ...prev, [itemId]: done }));
      if (tapResult?.state_log_id) {
        try {
          await completionMutation.mutateAsync({
            checklist_item_id: itemId,
            state_log_id: tapResult.state_log_id,
            completed: done,
          });
        } catch {
          // Revert on failure
          setChecklistStates((prev) => ({ ...prev, [itemId]: !done }));
        }
      }
    },
    [tapResult?.state_log_id, completionMutation],
  );

  const handleAllDone = useCallback(async () => {
    if (!tapResult) return;
    // Complete all triggered items
    for (const item of tapResult.triggered_items) {
      try {
        await safeFetch(`/api/items/${item.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occurrence_date: new Date().toISOString().split("T")[0],
            is_recurring: false,
          }),
        });
      } catch {
        // Continue even if one fails
      }
    }
    // Navigate to dashboard
    router.push("/dashboard?tab=dashboard&view=journal");
  }, [tapResult, router]);

  // ============================================
  // RENDER
  // ============================================

  if (tagLoading || phase === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (tagError || !tag || phase === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <WifiOff className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-semibold text-white/90">Tag Not Found</h1>
        <p className="text-sm text-white/50 text-center">
          {tagError?.message ?? "This NFC tag is not configured or inactive."}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ---- DISABLED PHASE: tag is inactive ----
  if (phase === "disabled") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <div className="rounded-full bg-white/10 p-6">
          <ShieldOff className="h-12 w-12 text-white/40" />
        </div>
        <h1 className="text-xl font-semibold text-white/90">
          NFC Tag Disabled
        </h1>
        <p className="text-sm text-white/50 text-center max-w-xs">
          This NFC tag is currently disabled. Contact the household admin to
          re-enable it.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ---- CONFIRM PHASE: show predicted state + countdown ----
  if (phase === "confirm") {
    const isLeaving = nextState === "leaving";
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
        <div className="relative">
          <div
            className={`rounded-full p-6 ${isLeaving ? "bg-amber-500/20" : "bg-cyan-500/20"}`}
          >
            {isLeaving ? (
              <DoorOpen className="h-16 w-16 text-amber-400" />
            ) : (
              <Home className="h-16 w-16 text-cyan-400" />
            )}
          </div>
          {/* Countdown ring */}
          <div className="absolute -inset-2">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={isLeaving ? "text-amber-500/30" : "text-cyan-500/30"}
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(autoConfirmTimer / 3) * 283} 283`}
                className={isLeaving ? "text-amber-400" : "text-cyan-400"}
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            {isLeaving ? "Leaving Home?" : "Welcome Back!"}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Auto-confirming in {Math.max(0, autoConfirmTimer)}s...
          </p>
        </div>

        <button
          onClick={() => handleTap()}
          disabled={tapMutation.isPending}
          className={`w-full max-w-xs rounded-2xl px-8 py-4 text-lg font-semibold text-white transition-all active:scale-95 ${
            isLeaving
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-cyan-500 hover:bg-cyan-600"
          }`}
        >
          {tapMutation.isPending ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : isLeaving ? (
            "Yes, I'm Leaving"
          ) : (
            "Yes, I'm Home"
          )}
        </button>

        {/* Override: pick a different state */}
        {tag.states && tag.states.length > 0 && (
          <div className="flex gap-2">
            {(tag.states as string[])
              .filter((s) => s !== nextState)
              .map((state) => (
                <button
                  key={state}
                  onClick={() => handleOverride(state)}
                  className="rounded-lg bg-white/5 px-4 py-2 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
                >
                  Actually {state}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  // ---- ARRIVING PHASE ----
  if (phase === "arriving") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
        <div className="rounded-full bg-cyan-500/20 p-6">
          <Home className="h-16 w-16 text-cyan-400" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-2 text-sm text-white/50">
            <Wifi className="mr-1 inline h-3.5 w-3.5" />
            You&apos;re home
          </p>
        </div>

        {tapResult && tapResult.triggered_items.length > 0 && (
          <div className="w-full max-w-sm rounded-2xl bg-white/5 p-4">
            <p className="text-sm font-medium text-cyan-400">
              {tapResult.triggered_items.length} task
              {tapResult.triggered_items.length > 1 ? "s" : ""} for tonight
            </p>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard?tab=dashboard&view=journal")}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-cyan-600 active:scale-95"
        >
          Open Dashboard
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  // ---- CHECKLIST PHASE: show checklist items for the current state ----
  if (phase === "leaving") {
    const currentState = tapResult?.new_state ?? "leaving";
    const isLeaving = currentState === "leaving";
    const triggeredItems: TriggeredItem[] = tapResult?.triggered_items ?? [];
    const checklistItems: NfcChecklistItemWithStatus[] =
      tapResult?.checklist_items ?? [];
    const recentActivity: NfcStateLog[] = tapResult?.recent_activity ?? [];
    const hasChecklist = checklistItems.length > 0;
    const hasTriggered = triggeredItems.length > 0;
    const hasAnything = hasChecklist || hasTriggered;

    const allTriggeredSubtasks = triggeredItems.flatMap((item) =>
      item.subtasks.map((s) => ({ ...s, parentTitle: item.title })),
    );

    const allChecklistDone =
      checklistItems.length > 0 &&
      checklistItems.every((cl) => checklistStates[cl.id]);
    const allTriggeredDone =
      allTriggeredSubtasks.length > 0 &&
      allTriggeredSubtasks.every((s) => subtaskStates[s.id]);
    const allDone =
      hasAnything &&
      (!hasChecklist || allChecklistDone) &&
      (!hasTriggered || allTriggeredDone);

    return (
      <div className="flex min-h-[100dvh] flex-col px-6 py-8">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full p-3 ${isLeaving ? "bg-amber-500/20" : "bg-cyan-500/20"}`}
          >
            {isLeaving ? (
              <DoorOpen className="h-8 w-8 text-amber-400" />
            ) : (
              <Home className="h-8 w-8 text-cyan-400" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white capitalize">
              {currentState}
            </h1>
            <p className="text-sm text-white/50">
              {hasAnything
                ? "Before you go, check these off:"
                : "You're good to go!"}
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Clock className="h-3 w-3" />
              Recent Activity
            </h2>
            <div className="flex flex-col gap-1">
              {recentActivity.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="capitalize text-white/60">
                    {entry.new_state}
                  </span>
                  <span className="text-white/30">
                    {new Date(entry.changed_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasAnything ? (
          <div className="mt-12 flex flex-1 flex-col items-center justify-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <p className="text-white/70">
              No checklist items. You&apos;re good to go!
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3">
              {/* NFC tag checklist items (from DB) */}
              {hasChecklist && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="flex flex-col gap-2">
                    {checklistItems
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((cl) => {
                        const checked = checklistStates[cl.id] ?? false;
                        const isAuto = cl.is_auto_completed;
                        return (
                          <button
                            key={cl.id}
                            onClick={() => {
                              if (!isAuto) toggleChecklist(cl.id, !checked);
                            }}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                              checked
                                ? "bg-green-500/10"
                                : "bg-white/5 hover:bg-white/10"
                            } ${isAuto ? "cursor-default" : ""}`}
                          >
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                checked
                                  ? "border-green-400 bg-green-400"
                                  : "border-white/30"
                              }`}
                            >
                              {checked && (
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span
                                className={`text-sm transition-all ${
                                  checked
                                    ? "text-white/40 line-through"
                                    : "text-white/90"
                                }`}
                              >
                                {cl.title}
                              </span>
                              {isAuto && cl.source_tag_label && (
                                <span className="flex items-center gap-1 text-[10px] text-green-400/70">
                                  <Link2 className="h-2.5 w-2.5" />
                                  Verified by {cl.source_tag_label}
                                </span>
                              )}
                              {!isAuto &&
                                cl.source_tag_id &&
                                cl.source_tag_label && (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
                                    <Link2 className="h-2.5 w-2.5" />
                                    Linked to {cl.source_tag_label} — not
                                    verified
                                  </span>
                                )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Triggered items from prerequisites (if any) */}
              {triggeredItems.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white/5 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-amber-400/80">
                    {item.title}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {item.subtasks.map((subtask) => {
                      const checked = subtaskStates[subtask.id] ?? false;
                      return (
                        <button
                          key={subtask.id}
                          onClick={() => toggleSubtask(subtask.id, !checked)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                            checked
                              ? "bg-green-500/10"
                              : "bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                              checked
                                ? "border-green-400 bg-green-400"
                                : "border-white/30"
                            }`}
                          >
                            {checked && (
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <span
                            className={`text-sm transition-all ${
                              checked
                                ? "text-white/40 line-through"
                                : "text-white/90"
                            }`}
                          >
                            {subtask.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              {allDone ? (
                <button
                  onClick={handleAllDone}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-green-600 active:scale-95"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  All Done — Let&apos;s Go!
                </button>
              ) : (
                <button
                  onClick={handleAllDone}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-8 py-4 text-lg font-semibold text-white/60 transition-all hover:bg-white/15 active:scale-95"
                >
                  Skip & Leave
                </button>
              )}

              <button
                onClick={() => {
                  setPhase("confirm");
                  setAutoConfirmTimer(3);
                  setHasInitialized(false);
                }}
                className="mx-auto mt-3 flex items-center gap-1 text-xs text-white/30 hover:text-white/50"
              >
                <RotateCcw className="h-3 w-3" />
                Wrong state? Go back
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}
