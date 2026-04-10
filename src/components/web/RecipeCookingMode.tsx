// src/components/web/RecipeCookingMode.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCookingLog,
  useScaleRecipe,
  useSubstituteIngredient,
} from "@/features/recipes/hooks";
import { cn } from "@/lib/utils";
import type {
  CookingSubstitution,
  Recipe,
  RecipeDifficulty,
  RecipeIngredient,
  RecipeStep,
} from "@/types/recipe";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecipeCookingModeProps {
  recipe: Recipe;
  initialServings?: number;
  onBack: () => void;
  onComplete: () => void;
}

type CookingPhase = "prep" | "cooking" | "feedback";

interface ActiveTimer {
  id: string;
  stepNumber: number;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isAlarming: boolean;
}

// ─── Scale helpers ───────────────────────────────────────────────────────────

function scaleIngredientsLocally(
  ingredients: RecipeIngredient[],
  originalServings: number,
  targetServings: number,
): RecipeIngredient[] {
  if (targetServings === originalServings) return ingredients;
  const ratio = targetServings / originalServings;
  return ingredients.map((ing) => {
    if (!ing.quantity) return ing;
    const parsed = parseFraction(String(ing.quantity));
    if (parsed === null) return ing;
    return { ...ing, quantity: formatQuantity(parsed * ratio) };
  });
}

function parseFraction(s: string): number | null {
  const trimmed = s.trim();
  const rangePart = trimmed.split("-")[0].trim();
  if (rangePart.includes("/")) {
    const [num, den] = rangePart.split("/").map(Number);
    if (isNaN(num) || isNaN(den) || den === 0) return null;
    return num / den;
  }
  const parts = rangePart.split(/\s+/);
  if (parts.length === 2 && parts[1].includes("/")) {
    const whole = Number(parts[0]);
    const [fn, fd] = parts[1].split("/").map(Number);
    if (isNaN(whole) || isNaN(fn) || isNaN(fd) || fd === 0) return null;
    return whole + fn / fd;
  }
  const n = Number(rangePart);
  return isNaN(n) ? null : n;
}

function formatQuantity(n: number): string {
  if (n === 0) return "0";
  const frac = n % 1;
  const whole = Math.floor(n);
  const fractions: Record<string, number> = {
    "⅛": 0.125,
    "¼": 0.25,
    "⅓": 0.333,
    "⅜": 0.375,
    "½": 0.5,
    "⅝": 0.625,
    "⅔": 0.667,
    "¾": 0.75,
    "⅞": 0.875,
  };
  if (frac < 0.05) return String(whole || n);
  for (const [sym, val] of Object.entries(fractions)) {
    if (Math.abs(frac - val) < 0.05) return whole ? `${whole} ${sym}` : sym;
  }
  return n < 0.1 ? n.toFixed(2) : n % 1 === 0 ? String(n) : n.toFixed(1);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Ingredient-to-step matching ────────────────────────────────────────────

function getIngredientUsedInSteps(
  ingredientName: string,
  steps: RecipeStep[],
): number[] {
  const lower = ingredientName.toLowerCase();
  // Build search terms from the ingredient name
  const words = lower.split(/[\s,]+/).filter((w) => w.length > 2);
  const used: number[] = [];
  for (const step of steps) {
    const inst = step.instruction.toLowerCase();
    // Match if ANY significant word from the ingredient name appears in the step
    if (words.some((w) => inst.includes(w))) {
      used.push(step.step);
    }
  }
  return used;
}

function groupBySection(
  ingredients: RecipeIngredient[],
): Map<string, RecipeIngredient[]> {
  const groups = new Map<string, RecipeIngredient[]>();
  for (const ing of ingredients) {
    const section = ing.section || "Ingredients";
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)!.push(ing);
  }
  return groups;
}

// ─── Alarm Audio ────────────────────────────────────────────────────────────

let alarmAudioCtx: AudioContext | null = null;
let alarmOscillator: OscillatorNode | null = null;
let alarmGain: GainNode | null = null;

function startAlarmSound() {
  try {
    if (!alarmAudioCtx) alarmAudioCtx = new AudioContext();
    if (alarmOscillator) return;
    alarmOscillator = alarmAudioCtx.createOscillator();
    alarmGain = alarmAudioCtx.createGain();
    alarmOscillator.type = "square";
    alarmOscillator.frequency.value = 880;
    alarmGain.gain.value = 0.15;
    alarmOscillator.connect(alarmGain);
    alarmGain.connect(alarmAudioCtx.destination);
    alarmOscillator.start();
    const pulse = () => {
      if (!alarmGain || !alarmAudioCtx) return;
      alarmGain.gain.setValueAtTime(0.15, alarmAudioCtx.currentTime);
      alarmGain.gain.setValueAtTime(0, alarmAudioCtx.currentTime + 0.15);
      alarmGain.gain.setValueAtTime(0.15, alarmAudioCtx.currentTime + 0.3);
      alarmGain.gain.setValueAtTime(0, alarmAudioCtx.currentTime + 0.45);
    };
    pulse();
    (window as any).__alarmInterval = setInterval(pulse, 600);
  } catch {
    /* Audio not supported */
  }
}

function stopAlarmSound() {
  try {
    if (alarmOscillator) {
      alarmOscillator.stop();
      alarmOscillator.disconnect();
      alarmOscillator = null;
    }
    if (alarmGain) {
      alarmGain.disconnect();
      alarmGain = null;
    }
    if ((window as any).__alarmInterval) {
      clearInterval((window as any).__alarmInterval);
      (window as any).__alarmInterval = null;
    }
  } catch {
    /* ignore */
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function RecipeCookingMode({
  recipe,
  initialServings,
  onBack,
  onComplete,
}: RecipeCookingModeProps) {
  const scaleRecipe = useScaleRecipe();
  const substituteIngredient = useSubstituteIngredient();
  const createCookingLog = useCreateCookingLog();

  const [phase, setPhase] = useState<CookingPhase>("prep");

  // ── Scaling ───────────────────────────────────────────────────
  const baseServings = recipe.servings || 4;
  const [servings, setServings] = useState(initialServings ?? baseServings);
  const [localIngredients, setLocalIngredients] = useState<RecipeIngredient[]>(
    () =>
      initialServings && initialServings !== baseServings
        ? scaleIngredientsLocally(
            recipe.ingredients,
            baseServings,
            initialServings,
          )
        : recipe.ingredients,
  );
  const [aiIngredients, setAiIngredients] = useState<RecipeIngredient[] | null>(
    null,
  );
  const [aiAdjustedNames, setAiAdjustedNames] = useState<Set<string>>(
    new Set(),
  );
  const [scaleReasoning, setScaleReasoning] = useState<string | null>(null);
  const [aiRefining, setAiRefining] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestServingsRef = useRef(servings);

  const ingredients = aiIngredients ?? localIngredients;
  const ingredientSections = useMemo(
    () => groupBySection(ingredients),
    [ingredients],
  );

  const requestAiRefinement = useCallback(
    (target: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (target === baseServings) {
        setAiIngredients(null);
        setAiAdjustedNames(new Set());
        setScaleReasoning(null);
        setAiRefining(false);
        return;
      }
      setAiRefining(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await scaleRecipe.mutateAsync({
            id: recipe.id,
            targetServings: target,
            currentServings: baseServings,
            ingredients: recipe.ingredients,
          });
          if (latestServingsRef.current === target) {
            const localScaled = scaleIngredientsLocally(
              recipe.ingredients,
              baseServings,
              target,
            );
            const changed = new Set<string>();
            result.ingredients.forEach((aiIng: RecipeIngredient, i: number) => {
              const localIng = localScaled[i];
              if (
                localIng &&
                String(aiIng.quantity) !== String(localIng.quantity)
              )
                changed.add(aiIng.name);
            });
            setAiIngredients(result.ingredients);
            setAiAdjustedNames(changed);
            setScaleReasoning(result.reasoning);
          }
        } catch {
          /* local math stays */
        } finally {
          if (latestServingsRef.current === target) setAiRefining(false);
        }
      }, 800);
    },
    [baseServings, recipe.id, recipe.ingredients, scaleRecipe],
  );

  const handleServingChange = useCallback(
    (target: number) => {
      if (target < 1 || target > 50) return;
      latestServingsRef.current = target;
      setServings(target);
      if (target === baseServings) {
        setLocalIngredients(recipe.ingredients);
        setAiIngredients(null);
        setAiAdjustedNames(new Set());
        setScaleReasoning(null);
      } else {
        setLocalIngredients(
          scaleIngredientsLocally(recipe.ingredients, baseServings, target),
        );
        setAiIngredients(null);
        setAiAdjustedNames(new Set());
      }
      requestAiRefinement(target);
    },
    [baseServings, recipe.ingredients, requestAiRefinement],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
  useEffect(() => {
    if (initialServings && initialServings !== baseServings)
      requestAiRefinement(initialServings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Substitution Chat ─────────────────────────────────────────
  const [subQuestion, setSubQuestion] = useState("");
  const [activeSubIngredient, setActiveSubIngredient] = useState<string | null>(
    null,
  );
  const [subResult, setSubResult] = useState<{
    answer?: string;
    suggestions: Array<{
      name: string;
      quantity: string;
      unit: string;
      notes: string;
      impact: string;
    }>;
  } | null>(null);
  const [substitutions, setSubstitutions] = useState<CookingSubstitution[]>([]);

  const handleAskSubstitution = async () => {
    if (!activeSubIngredient) return;
    try {
      const result = await substituteIngredient.mutateAsync({
        recipeId: recipe.id,
        ingredient: activeSubIngredient,
        question: subQuestion || undefined,
        recipeName: recipe.name,
        allIngredients: ingredients.map((i) => i.name),
      });
      setSubResult(result);
    } catch {
      /* handled by hook toast */
    }
  };

  const addSubstitution = (original: string, replacement: string) => {
    setSubstitutions((prev) => [
      ...prev,
      { original, replaced_with: replacement },
    ]);
  };

  // ── Steps / Cooking ───────────────────────────────────────────
  const steps = recipe.steps;
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedParallel, setExpandedParallel] = useState(true);

  const prerequisiteSteps = useMemo(
    () => steps.filter((s) => s.is_prerequisite),
    [steps],
  );

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  // ── Ingredient-Step association (for strikethrough) ───────────
  const ingredientStepMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const ing of recipe.ingredients) {
      map.set(ing.name, getIngredientUsedInSteps(ing.name, steps));
    }
    return map;
  }, [recipe.ingredients, steps]);

  const isIngredientDone = useCallback(
    (ingName: string): boolean => {
      const usedInSteps = ingredientStepMap.get(ingName) || [];
      if (usedInSteps.length === 0) return false;
      return usedInSteps.every((sn) => completedSteps.has(sn));
    },
    [ingredientStepMap, completedSteps],
  );

  // Sort ingredients: active first, done pushed to bottom
  const sortedIngredientSections = useMemo(() => {
    const result = new Map<
      string,
      { active: RecipeIngredient[]; done: RecipeIngredient[] }
    >();
    for (const [section, ings] of ingredientSections.entries()) {
      const active: RecipeIngredient[] = [];
      const done: RecipeIngredient[] = [];
      for (const ing of ings) {
        if (isIngredientDone(ing.name)) done.push(ing);
        else active.push(ing);
      }
      result.set(section, { active, done });
    }
    return result;
  }, [ingredientSections, isIngredientDone]);

  // ── Multi-Timer System ────────────────────────────────────────
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimers((prev) => {
        let hasChange = false;
        const next = prev.map((t) => {
          if (!t.isRunning || t.isAlarming || t.remainingSeconds <= 0) return t;
          hasChange = true;
          const remaining = t.remainingSeconds - 1;
          if (remaining <= 0) {
            startAlarmSound();
            return {
              ...t,
              remainingSeconds: 0,
              isRunning: false,
              isAlarming: true,
            };
          }
          return { ...t, remainingSeconds: remaining };
        });
        return hasChange ? next : prev;
      });
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => () => stopAlarmSound(), []);

  const startTimer = (step: RecipeStep) => {
    if (!step.duration_minutes) return;
    const id = `timer-${step.step}-${Date.now()}`;
    setTimers((prev) => [
      ...prev,
      {
        id,
        stepNumber: step.step,
        label: `Step ${step.step}`,
        totalSeconds: step.duration_minutes! * 60,
        remainingSeconds: step.duration_minutes! * 60,
        isRunning: true,
        isAlarming: false,
      },
    ]);
  };

  const stopTimerAlarm = (timerId: string) => {
    setTimers((prev) => {
      const next = prev.filter((t) => t.id !== timerId);
      if (!next.some((t) => t.isAlarming)) stopAlarmSound();
      return next;
    });
  };

  const addTimeToTimer = (timerId: string, extraMinutes: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === timerId
          ? {
              ...t,
              remainingSeconds: t.remainingSeconds + extraMinutes * 60,
              totalSeconds: t.totalSeconds + extraMinutes * 60,
              isRunning: true,
              isAlarming: false,
            }
          : t,
      ),
    );
    stopAlarmSound();
  };

  const pauseResumeTimer = (timerId: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === timerId ? { ...t, isRunning: !t.isRunning } : t,
      ),
    );
  };

  // ── Feedback ──────────────────────────────────────────────────
  const [actualPrepMinutes, setActualPrepMinutes] = useState<number | "">(
    recipe.prep_time_minutes || "",
  );
  const [actualCookMinutes, setActualCookMinutes] = useState<number | "">(
    recipe.cook_time_minutes || "",
  );
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<string>(
    recipe.difficulty,
  );
  const [rating, setRating] = useState(0);
  const [tasteNotes, setTasteNotes] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [wouldMakeAgain, setWouldMakeAgain] = useState<boolean | null>(null);

  const handleSubmitFeedback = async () => {
    try {
      await createCookingLog.mutateAsync({
        recipeId: recipe.id,
        version_id: recipe.active_version_id || null,
        actual_prep_minutes: actualPrepMinutes || null,
        actual_cook_minutes: actualCookMinutes || null,
        perceived_difficulty: (perceivedDifficulty as RecipeDifficulty) || null,
        substitutions,
        servings_made: servings,
        rating: rating || null,
        taste_notes: tasteNotes || null,
        general_notes: generalNotes || null,
        would_make_again: wouldMakeAgain,
      });
      onComplete();
    } catch {
      /* handled by hook toast */
    }
  };

  const alarmingTimers = timers.filter((t) => t.isAlarming);
  const runningTimers = timers.filter((t) => t.isRunning || t.isAlarming);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Fixed fullscreen overlay, warm cooking palette
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F6F1EB] overflow-hidden">
      {/* ── Alarm Overlay ── */}
      {alarmingTimers.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[90vw] max-w-[420px] bg-white border-2 border-red-400/50 rounded-3xl p-8 text-center shadow-2xl shadow-red-500/10">
            <div className="animate-bounce mb-4">
              <BellRing className="w-20 h-20 text-red-500 mx-auto" />
            </div>
            <h2 className="text-3xl font-bold text-stone-800 mb-1">
              Timer Done!
            </h2>
            {alarmingTimers.map((t) => (
              <div key={t.id} className="mb-5 mt-4">
                <p className="text-lg text-stone-500 mb-4">
                  {t.label} — {Math.round(t.totalSeconds / 60)}m completed
                </p>
                <div className="flex gap-2.5 justify-center flex-wrap">
                  {[1, 2, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => addTimeToTimer(t.id, m)}
                      className="px-5 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 text-lg font-semibold active:scale-95 transition-transform"
                    >
                      +{m}m
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => stopTimerAlarm(t.id)}
                    className="px-5 py-3 rounded-xl bg-red-500 text-white text-lg font-semibold flex items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Volume2 className="w-5 h-5" /> Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="shrink-0 bg-white/90 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 rounded-xl bg-stone-100 active:bg-stone-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-stone-900 truncate flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 shrink-0" />
            {recipe.name}
          </h1>
        </div>
        {/* Phase pills */}
        <div className="flex items-center gap-1 shrink-0">
          {(["prep", "cooking", "feedback"] as CookingPhase[]).map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                phase === p
                  ? "bg-stone-800 text-white shadow-md"
                  : "text-stone-400 active:text-stone-600",
              )}
            >
              {i + 1}.{" "}
              {p === "prep" ? "Prep" : p === "cooking" ? "Cook" : "Done"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Floating Timers ── */}
      {runningTimers.length > 0 && (
        <div className="shrink-0 bg-amber-50/80 backdrop-blur-sm border-b border-amber-200/60 px-4 py-1.5 flex items-center gap-2.5 overflow-x-auto">
          <Timer className="w-4 h-4 text-amber-600 shrink-0" />
          {runningTimers.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full text-sm shrink-0",
                t.isAlarming
                  ? "bg-red-100 border border-red-300 animate-pulse"
                  : t.remainingSeconds < 60
                    ? "bg-amber-100 border border-amber-300"
                    : "bg-white border border-stone-200",
              )}
            >
              <span className="text-stone-500 text-xs">{t.label}</span>
              <span
                className={cn(
                  "font-mono font-bold text-sm",
                  t.isAlarming
                    ? "text-red-600"
                    : t.remainingSeconds < 60
                      ? "text-amber-700"
                      : "text-stone-800",
                )}
              >
                {t.isAlarming ? "DONE" : formatTime(t.remainingSeconds)}
              </span>
              {!t.isAlarming && (
                <button
                  type="button"
                  onClick={() => pauseResumeTimer(t.id)}
                  className="p-0.5"
                >
                  {t.isRunning ? (
                    <Pause className="w-3 h-3 text-stone-400" />
                  ) : (
                    <Play className="w-3 h-3 text-stone-400" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* ═══════════════════════════════════════════════════════
              PREP PHASE
              ═══════════════════════════════════════════════════════ */}
          {phase === "prep" && (
            <div className="space-y-4">
              {/* Servings */}
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                      How many servings?
                    </span>
                    <p className="text-stone-800 font-bold text-lg mt-0.5">
                      Adjust for your table
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleServingChange(servings - 1)}
                      disabled={servings <= 1}
                      className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center text-xl font-bold disabled:opacity-30 active:scale-90 active:bg-stone-200 transition-all"
                    >
                      −
                    </button>
                    <span className="w-14 text-center text-3xl font-black text-stone-900">
                      {servings}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleServingChange(servings + 1)}
                      disabled={servings >= 50}
                      className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center text-xl font-bold disabled:opacity-30 active:scale-90 active:bg-stone-200 transition-all"
                    >
                      +
                    </button>
                    {aiRefining && (
                      <Sparkles className="w-5 h-5 text-amber-500 animate-pulse ml-1" />
                    )}
                  </div>
                </div>
                {servings !== baseServings &&
                  scaleReasoning &&
                  aiIngredients && (
                    <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg p-2.5 mt-3 leading-relaxed border border-indigo-100">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {scaleReasoning}
                    </p>
                  )}
              </div>

              {/* Ingredient Sections */}
              {Array.from(sortedIngredientSections.entries()).map(
                ([section, { active, done }]) => (
                  <div
                    key={section}
                    className="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm"
                  >
                    {/* Section header */}
                    <div className="px-5 py-3 bg-gradient-to-r from-stone-50 to-white border-b border-stone-200 flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                      <span className="text-[13px] font-extrabold text-stone-700 uppercase tracking-widest">
                        {section}
                      </span>
                      <span className="ml-auto text-xs font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                        {active.length + done.length} items
                      </span>
                    </div>

                    {/* Table column headers */}
                    <div className="grid grid-cols-[90px_1fr_auto_36px] items-center gap-x-3 px-5 py-2 border-b border-stone-100 bg-stone-50/60">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider text-center">
                        Qty
                      </span>
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Ingredient
                      </span>
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">
                        Note
                      </span>
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider text-center">
                        ✦
                      </span>
                    </div>

                    {/* Active ingredients */}
                    {active.map((ing, i) => (
                      <div key={`a-${i}`} className="group">
                        <div
                          className="grid grid-cols-[90px_1fr_auto_36px] items-center gap-x-3 px-5 py-3.5 border-b border-stone-100 cursor-pointer hover:bg-amber-50/40 active:bg-amber-50/70 transition-colors"
                          onClick={() => {
                            setActiveSubIngredient(
                              activeSubIngredient === ing.name
                                ? null
                                : ing.name,
                            );
                            setSubQuestion("");
                            setSubResult(null);
                          }}
                        >
                          {/* Quantity */}
                          <div
                            className={cn(
                              "text-center px-2 py-1.5 rounded-lg font-mono font-extrabold text-[14px] leading-tight",
                              aiAdjustedNames.has(ing.name)
                                ? "bg-amber-50 text-amber-800 border border-amber-300 ring-2 ring-amber-200/50"
                                : "bg-stone-100 text-stone-900",
                            )}
                          >
                            {ing.quantity || "—"}
                            {ing.unit ? ` ${ing.unit}` : ""}
                            {aiAdjustedNames.has(ing.name) && (
                              <Sparkles className="w-3 h-3 inline ml-1 text-amber-500" />
                            )}
                          </div>
                          {/* Name */}
                          <span className="text-[15px] text-stone-900 font-semibold leading-snug">
                            {ing.name}
                            {ing.optional && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 font-medium align-middle">
                                optional
                              </span>
                            )}
                          </span>
                          {/* Notes */}
                          <span className="text-xs text-stone-400 italic max-w-[130px] truncate text-right">
                            {ing.notes || ""}
                          </span>
                          {/* Action icon */}
                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full border-2 border-stone-200 flex items-center justify-center group-hover:border-indigo-300 group-hover:bg-indigo-50 transition-colors">
                              <MessageCircle className="w-3.5 h-3.5 text-stone-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                          </div>
                        </div>

                        {/* Substitution panel */}
                        {activeSubIngredient === ing.name && (
                          <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 space-y-3">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-indigo-500" />
                              <span className="text-sm text-indigo-700 font-semibold">
                                AI — {ing.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSubIngredient(null);
                                  setSubResult(null);
                                }}
                                className="ml-auto p-1 text-stone-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={subQuestion}
                                onChange={(e) => setSubQuestion(e.target.value)}
                                placeholder="What can I use instead?"
                                className="flex-1 bg-white border-stone-200 text-stone-800 placeholder:text-stone-400 text-sm"
                                onKeyDown={(e) =>
                                  e.key === "Enter" && handleAskSubstitution()
                                }
                              />
                              <Button
                                size="sm"
                                onClick={handleAskSubstitution}
                                disabled={substituteIngredient.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shrink-0"
                              >
                                {substituteIngredient.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                Ask
                              </Button>
                            </div>
                            {subResult && (
                              <div className="space-y-2">
                                {subResult.answer && (
                                  <p className="text-sm text-stone-600">
                                    {subResult.answer}
                                  </p>
                                )}
                                {subResult.suggestions.map((s, si) => (
                                  <div
                                    key={si}
                                    className="p-2.5 rounded-xl bg-white flex items-start gap-2 border border-stone-200"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm text-stone-800 font-medium">
                                        {s.quantity} {s.unit} {s.name}
                                      </p>
                                      <p className="text-xs text-stone-400 mt-0.5">
                                        {s.impact}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addSubstitution(
                                          ing.name,
                                          `${s.quantity} ${s.unit} ${s.name}`,
                                        );
                                        setActiveSubIngredient(null);
                                        setSubResult(null);
                                      }}
                                      className="text-xs text-emerald-700 font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 active:bg-emerald-100 shrink-0"
                                    >
                                      Use
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Done ingredients (strikethrough, pushed to bottom) */}
                    {done.length > 0 && (
                      <>
                        {active.length > 0 && (
                          <div className="flex items-center gap-3 px-5 py-1.5 bg-emerald-50/40">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                              Done — used in completed steps
                            </span>
                          </div>
                        )}
                        {done.map((ing, i) => (
                          <div
                            key={`d-${i}`}
                            className="grid grid-cols-[90px_1fr_auto_36px] items-center gap-x-3 px-5 py-2 border-b border-stone-50 opacity-40"
                          >
                            <div className="text-center px-2 py-1 rounded-lg font-mono text-sm bg-stone-50 text-stone-400 line-through">
                              {ing.quantity || "—"}
                              {ing.unit ? ` ${ing.unit}` : ""}
                            </div>
                            <span className="text-[15px] text-stone-400 line-through">
                              {ing.name}
                            </span>
                            <span className="text-xs text-stone-300 italic truncate text-right">
                              {ing.notes || ""}
                            </span>
                            <div className="flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Check className="w-4 h-4 text-emerald-500" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ),
              )}

              {/* Substitutions */}
              {substitutions.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
                  <h3 className="text-[11px] text-stone-400 mb-3 flex items-center gap-2 font-extrabold uppercase tracking-widest">
                    <RefreshCw className="w-4 h-4 text-indigo-500" /> Ingredient
                    Swaps
                  </h3>
                  {substitutions.map((sub, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 text-sm py-1.5"
                    >
                      <span className="text-red-500/80 line-through font-medium">
                        {sub.original}
                      </span>
                      <span className="text-stone-300">→</span>
                      <span className="text-emerald-700 font-semibold">
                        {sub.replaced_with}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSubstitutions((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="ml-auto text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Start Cooking CTA */}
              <button
                type="button"
                onClick={() => setPhase("cooking")}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-extrabold text-xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-[0.97] transition-all hover:shadow-2xl hover:shadow-emerald-600/40"
              >
                <ChefHat className="w-7 h-7" />
                <span>Let&apos;s Cook!</span>
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              COOKING PHASE
              ═══════════════════════════════════════════════════════ */}
          {phase === "cooking" && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Your progress
                  </span>
                  <span className="text-sm font-extrabold text-stone-800">
                    {completedSteps.size}{" "}
                    <span className="text-stone-400 font-normal">of</span>{" "}
                    {steps.length}{" "}
                    <span className="text-stone-400 font-normal">steps</span>
                  </span>
                </div>
                <div className="h-3.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out shadow-sm shadow-emerald-500/30"
                    style={{
                      width: `${steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Prerequisites */}
              {prerequisiteSteps.length > 0 &&
                !prerequisiteSteps.every((s) => completedSteps.has(s.step)) && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-bold text-amber-700 uppercase tracking-wide">
                        Do First
                      </span>
                    </div>
                    {prerequisiteSteps
                      .filter((s) => !completedSteps.has(s.step))
                      .map((step) => (
                        <button
                          key={step.step}
                          type="button"
                          onClick={() => toggleStep(step.step)}
                          className="w-full flex items-center gap-3 py-2 text-left active:bg-amber-100 rounded-xl px-2 -mx-2"
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 text-sm font-bold",
                              completedSteps.has(step.step)
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-amber-400 text-amber-600",
                            )}
                          >
                            {completedSteps.has(step.step) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              step.step
                            )}
                          </div>
                          <span className="text-[15px] text-stone-700 flex-1">
                            {step.instruction}
                          </span>
                        </button>
                      ))}
                  </div>
                )}

              {/* Step dots navigation */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 px-1">
                {steps.map((step, idx) => (
                  <button
                    key={step.step}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all active:scale-90",
                      completedSteps.has(step.step)
                        ? "bg-emerald-100 text-emerald-600 border border-emerald-300"
                        : idx === currentStep
                          ? "bg-stone-800 text-white shadow-lg shadow-stone-800/20 scale-110"
                          : step.is_prerequisite &&
                              !completedSteps.has(step.step)
                            ? "bg-amber-100 text-amber-600 border border-amber-300"
                            : "bg-stone-100 text-stone-400",
                    )}
                  >
                    {completedSteps.has(step.step) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.step
                    )}
                  </button>
                ))}
              </div>

              {/* ── HERO STEP ── */}
              {steps[currentStep] &&
                (() => {
                  const step = steps[currentStep];
                  const done = completedSteps.has(step.step);
                  const timer = timers.find(
                    (t) =>
                      t.stepNumber === step.step &&
                      (t.isRunning || t.isAlarming),
                  );

                  return (
                    <div
                      className={cn(
                        "rounded-2xl border-2 p-0 transition-all overflow-hidden",
                        done
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-white border-stone-200 shadow-md",
                      )}
                    >
                      {/* Step label bar */}
                      <div
                        className={cn(
                          "px-5 py-2.5 flex items-center gap-2.5",
                          done
                            ? "bg-emerald-100"
                            : "bg-gradient-to-r from-stone-800 to-stone-700",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-extrabold uppercase tracking-widest",
                            done ? "text-emerald-700" : "text-white/70",
                          )}
                        >
                          Step {step.step} {done ? "— Done!" : "— Now do this:"}
                        </span>
                        {step.duration_minutes && (
                          <span
                            className={cn(
                              "ml-auto text-xs font-bold flex items-center gap-1",
                              done ? "text-emerald-600" : "text-white/50",
                            )}
                          >
                            <Clock className="w-3.5 h-3.5" />{" "}
                            {step.duration_minutes} min
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        {/* Step number + check */}
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              toggleStep(step.step);
                              if (!done && currentStep < steps.length - 1)
                                setTimeout(
                                  () => setCurrentStep(currentStep + 1),
                                  300,
                                );
                            }}
                            className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black transition-all active:scale-90",
                              done
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                                : "bg-stone-100 text-stone-600 border-2 border-stone-200",
                            )}
                          >
                            {done ? <Check className="w-7 h-7" /> : step.step}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-[18px] leading-relaxed",
                                done
                                  ? "text-emerald-600/50 line-through font-medium"
                                  : "text-stone-900 font-bold",
                              )}
                            >
                              {step.instruction}
                            </p>

                            {/* Meta badges */}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              {step.is_prerequisite && (
                                <span className="text-xs text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                                  <Zap className="w-3 h-3" /> Do this first!
                                </span>
                              )}
                              {step.parallel_with &&
                                step.parallel_with.length > 0 && (
                                  <span className="text-xs text-sky-700 bg-sky-100 px-2.5 py-1 rounded-full font-bold border border-sky-200">
                                    ⚡ Can pair with step{" "}
                                    {step.parallel_with.join(", ")}
                                  </span>
                                )}
                            </div>

                            {/* Tip */}
                            {step.tip && (
                              <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                                <p className="text-sm text-stone-800 leading-relaxed">
                                  <span className="font-bold text-amber-700">
                                    💡 Tip:{" "}
                                  </span>
                                  {step.tip}
                                </p>
                              </div>
                            )}

                            {/* Timer */}
                            {step.duration_minutes && (
                              <div className="mt-4">
                                {timer ? (
                                  <div
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-xl",
                                      timer.isAlarming
                                        ? "bg-red-50 border border-red-300"
                                        : "bg-stone-50 border border-stone-200",
                                    )}
                                  >
                                    <Bell
                                      className={cn(
                                        "w-5 h-5 shrink-0",
                                        timer.isAlarming
                                          ? "text-red-500 animate-bounce"
                                          : "text-stone-500",
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "font-mono text-2xl font-black",
                                        timer.isAlarming
                                          ? "text-red-600"
                                          : "text-stone-800",
                                      )}
                                    >
                                      {timer.isAlarming
                                        ? "DONE!"
                                        : formatTime(timer.remainingSeconds)}
                                    </span>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      {timer.isAlarming ? (
                                        <>
                                          {[2, 5].map((m) => (
                                            <button
                                              key={m}
                                              type="button"
                                              onClick={() =>
                                                addTimeToTimer(timer.id, m)
                                              }
                                              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold"
                                            >
                                              +{m}m
                                            </button>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              stopTimerAlarm(timer.id)
                                            }
                                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold flex items-center gap-1"
                                          >
                                            <Volume2 className="w-3 h-3" /> Stop
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              pauseResumeTimer(timer.id)
                                            }
                                            className="p-2 rounded-lg active:bg-stone-100"
                                          >
                                            {timer.isRunning ? (
                                              <Pause className="w-4 h-4 text-stone-500" />
                                            ) : (
                                              <Play className="w-4 h-4 text-stone-500" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              addTimeToTimer(timer.id, 1)
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500 text-xs font-semibold"
                                          >
                                            +1m
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startTimer(step)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-stone-800 to-stone-700 text-white font-bold text-sm active:scale-95 transition-transform shadow-md"
                                  >
                                    <Timer className="w-4 h-4" /> Start{" "}
                                    {step.duration_minutes}m Timer
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nav buttons */}
                        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentStep(Math.max(0, currentStep - 1))
                            }
                            disabled={currentStep <= 0}
                            className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-500 font-semibold text-sm disabled:opacity-20 active:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ArrowLeft className="w-4 h-4" /> Prev
                          </button>
                          {!done ? (
                            <button
                              type="button"
                              onClick={() => {
                                toggleStep(step.step);
                                if (currentStep < steps.length - 1)
                                  setTimeout(
                                    () => setCurrentStep(currentStep + 1),
                                    250,
                                  );
                              }}
                              className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-base active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                            >
                              <Check className="w-5 h-5" /> Mark Done
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                currentStep < steps.length - 1 &&
                                setCurrentStep(currentStep + 1)
                              }
                              className="flex-[2] py-3 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5 border border-emerald-200"
                            >
                              ✓ Completed — Next
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ── Parallel Steps ── */}
              {steps[currentStep]?.parallel_with &&
                steps[currentStep].parallel_with!.length > 0 && (
                  <div className="bg-sky-50 rounded-2xl border border-sky-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedParallel(!expandedParallel)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left"
                    >
                      <Zap className="w-4 h-4 text-sky-600" />
                      <span className="text-sm font-bold text-sky-700 flex-1">
                        While waiting — do these:
                      </span>
                      {expandedParallel ? (
                        <ChevronUp className="w-4 h-4 text-sky-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-sky-400" />
                      )}
                    </button>
                    {expandedParallel && (
                      <div className="px-4 pb-3 space-y-1.5">
                        {steps[currentStep].parallel_with!.map((sn) => {
                          const ps = steps.find((s) => s.step === sn);
                          if (!ps) return null;
                          const psDone = completedSteps.has(ps.step);
                          return (
                            <button
                              key={sn}
                              type="button"
                              onClick={() => toggleStep(ps.step)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white active:bg-sky-50 text-left border border-sky-100"
                            >
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                                  psDone
                                    ? "bg-emerald-500 text-white"
                                    : "bg-sky-100 text-sky-600 border border-sky-300",
                                )}
                              >
                                {psDone ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  ps.step
                                )}
                              </div>
                              <span
                                className={cn(
                                  "text-sm flex-1",
                                  psDone
                                    ? "text-stone-400 line-through"
                                    : "text-stone-700",
                                )}
                              >
                                {ps.instruction}
                              </span>
                              {ps.duration_minutes && (
                                <span className="text-xs text-stone-400">
                                  {ps.duration_minutes}m
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              {/* ── Remaining steps list ── */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-5 py-2.5 bg-stone-50 border-b border-stone-100">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                    All Steps
                  </span>
                </div>
                {steps.map((step, idx) => {
                  if (idx === currentStep) return null;
                  const done = completedSteps.has(step.step);
                  const hasTimer = timers.some(
                    (t) => t.stepNumber === step.step && t.isRunning,
                  );
                  return (
                    <button
                      key={step.step}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors border-b border-stone-50 last:border-b-0",
                        done
                          ? "opacity-35 bg-stone-50/50"
                          : hasTimer
                            ? "bg-amber-50 border-l-4 border-l-amber-400"
                            : "hover:bg-stone-50 active:bg-stone-100",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          done
                            ? "bg-emerald-100 text-emerald-600"
                            : step.is_prerequisite
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-stone-100 text-stone-500",
                        )}
                      >
                        {done ? <Check className="w-3.5 h-3.5" /> : step.step}
                      </div>
                      <span
                        className={cn(
                          "flex-1 text-[14px]",
                          done
                            ? "line-through text-stone-400"
                            : "text-stone-700 font-medium",
                        )}
                      >
                        {step.instruction}
                      </span>
                      {hasTimer && (
                        <span className="text-xs text-amber-700 bg-amber-100 font-mono font-bold flex items-center gap-1 px-2 py-0.5 rounded-full">
                          <Timer className="w-3 h-3" />
                          {formatTime(
                            timers.find(
                              (t) => t.stepNumber === step.step && t.isRunning,
                            )!.remainingSeconds,
                          )}
                        </span>
                      )}
                      {step.duration_minutes && !hasTimer && !done && (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                          {step.duration_minutes}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Done CTA */}
              {completedSteps.size === steps.length && steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPhase("feedback")}
                  className="w-full py-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-extrabold text-xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-[0.97] transition-all"
                >
                  <Star className="w-7 h-7" /> You nailed it! Rate it →
                </button>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FEEDBACK PHASE
              ═══════════════════════════════════════════════════════ */}
          {phase === "feedback" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-6">
                <div className="text-center pb-3 border-b border-stone-100">
                  <h2 className="text-xl font-extrabold text-stone-800">
                    🍳 How did it go?
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Quick feedback = better AI suggestions next time
                  </p>
                </div>

                {/* Rating */}
                <div>
                  <label className="text-sm text-stone-700 mb-2.5 block font-bold">
                    Overall Rating
                  </label>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRating(v)}
                        className="p-1 active:scale-90 transition-transform"
                      >
                        <Star
                          className={cn(
                            "w-10 h-10",
                            v <= rating
                              ? "fill-yellow-400 text-yellow-400 drop-shadow"
                              : "text-stone-200",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-stone-700 mb-1.5 block font-bold">
                      Prep (min)
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      min={0}
                      value={actualPrepMinutes}
                      onChange={(e) =>
                        setActualPrepMinutes(
                          e.target.value ? parseInt(e.target.value) : "",
                        )
                      }
                      placeholder={String(recipe.prep_time_minutes || "")}
                      className="bg-stone-50 border-stone-200 text-stone-800 text-center text-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-stone-700 mb-1.5 block font-bold">
                      Cook (min)
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      min={0}
                      value={actualCookMinutes}
                      onChange={(e) =>
                        setActualCookMinutes(
                          e.target.value ? parseInt(e.target.value) : "",
                        )
                      }
                      placeholder={String(recipe.cook_time_minutes || "")}
                      className="bg-stone-50 border-stone-200 text-stone-800 text-center text-lg font-bold"
                    />
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-sm text-stone-700 mb-2 block font-bold">
                    How hard was it?
                  </label>
                  <div className="flex gap-2">
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPerceivedDifficulty(d)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95",
                          perceivedDifficulty === d
                            ? d === "easy"
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : d === "medium"
                                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                : "bg-red-100 text-red-700 border border-red-300"
                            : "bg-stone-50 text-stone-400 border border-stone-200",
                        )}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Taste */}
                <div>
                  <label className="text-sm text-stone-700 mb-2 block font-bold">
                    Taste Notes
                  </label>
                  <Textarea
                    value={tasteNotes}
                    onChange={(e) => setTasteNotes(e.target.value)}
                    placeholder="Too salty, needed more garlic..."
                    className="bg-stone-50 border-stone-200 text-stone-800 placeholder:text-stone-400"
                    rows={2}
                  />
                </div>

                {/* General */}
                <div>
                  <label className="text-sm text-stone-700 mb-2 block font-bold">
                    General Notes
                  </label>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Tips for next time..."
                    className="bg-stone-50 border-stone-200 text-stone-800 placeholder:text-stone-400"
                    rows={2}
                  />
                </div>

                {/* Would make again */}
                <div>
                  <label className="text-sm text-stone-700 mb-2.5 block font-bold">
                    Would you cook this again?
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setWouldMakeAgain(true)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95",
                        wouldMakeAgain === true
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-stone-50 text-stone-400 border border-stone-200",
                      )}
                    >
                      <ThumbsUp className="w-5 h-5" /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setWouldMakeAgain(false)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95",
                        wouldMakeAgain === false
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-stone-50 text-stone-400 border border-stone-200",
                      )}
                    >
                      <ThumbsDown className="w-5 h-5" /> No
                    </button>
                  </div>
                </div>

                {/* Substitutions summary */}
                {substitutions.length > 0 && (
                  <div>
                    <label className="text-sm text-stone-600 mb-2 block font-semibold">
                      Substitutions Used
                    </label>
                    {substitutions.map((sub, i) => (
                      <div
                        key={i}
                        className="text-sm flex items-center gap-2 py-0.5"
                      >
                        <span className="text-red-500/70 line-through">
                          {sub.original}
                        </span>
                        <span className="text-stone-400">→</span>
                        <span className="text-emerald-600">
                          {sub.replaced_with}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={createCookingLog.isPending}
                className="w-full py-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-extrabold text-xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {createCookingLog.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Save Feedback
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
