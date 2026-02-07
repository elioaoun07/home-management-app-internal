// src/components/web/RecipeVersionCompare.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { AIFieldChange, Recipe, RecipeVersion } from "@/types/recipe";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";

interface RecipeVersionCompareProps {
  recipe: Recipe;
  versions: RecipeVersion[];
  changes?: AIFieldChange[];
  reasoning?: string;
  /** When provided, shows the AI optimization preview (before saving as version) */
  aiPreview?: {
    recipe: Partial<Recipe>;
    reasoning: string;
    changes: AIFieldChange[];
    tokensUsed: number | null;
  };
  onApplyVersion: (version: RecipeVersion) => void;
  onApplyAIPreview?: () => void;
  onSaveAsVersion?: (label: string) => void;
  onDismissPreview?: () => void;
}

export default function RecipeVersionCompare({
  recipe,
  versions,
  aiPreview,
  onApplyVersion,
  onApplyAIPreview,
  onSaveAsVersion,
  onDismissPreview,
}: RecipeVersionCompareProps) {
  const themeClasses = useThemeClasses();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [showAllChanges, setShowAllChanges] = useState(false);

  return (
    <div className="space-y-4">
      {/* AI Optimization Preview */}
      {aiPreview && (
        <Card
          className={cn(
            "p-5 border-2 border-emerald-500/30",
            themeClasses.surfaceBg,
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-white">AI Optimization</h3>
            {aiPreview.tokensUsed && (
              <span className="text-xs text-white/40 ml-auto">
                {aiPreview.tokensUsed} tokens
              </span>
            )}
          </div>

          {/* Reasoning */}
          <p className="text-sm text-white/70 mb-4 leading-relaxed">
            {aiPreview.reasoning}
          </p>

          {/* Changes list */}
          {aiPreview.changes.length > 0 && (
            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => setShowAllChanges(!showAllChanges)}
                className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white/80 transition-colors"
              >
                {showAllChanges ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {aiPreview.changes.length} changes made
              </button>

              {showAllChanges && (
                <div className="space-y-1.5 mt-2">
                  {aiPreview.changes.map((change, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg bg-white/5 text-sm"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-white/60">{change.field}: </span>
                        {change.from != null && (
                          <>
                            <span className="text-red-400/70 line-through">
                              {String(change.from)}
                            </span>
                            <span className="text-white/40 mx-1">→</span>
                          </>
                        )}
                        <span className="text-emerald-400">
                          {String(change.to)}
                        </span>
                        <p className="text-white/50 text-xs mt-0.5">
                          {change.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <Button
              size="sm"
              onClick={onApplyAIPreview}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4" />
              Apply Changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSaveAsVersion?.("AI Optimized")}
              className="gap-1.5 border-white/20 text-white/70"
            >
              <GitBranch className="w-4 h-4" />
              Save as New Version
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismissPreview}
              className="text-white/50 ml-auto"
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Versions ({versions.length})
          </h3>

          <div className="space-y-2">
            {versions.map((v) => (
              <Card
                key={v.id}
                className={cn(
                  "p-3 cursor-pointer transition-all",
                  themeClasses.surfaceBg,
                  v.is_active
                    ? "border-primary/40 bg-primary/5"
                    : "border-white/10 hover:border-white/20",
                )}
                onClick={() =>
                  setExpandedVersion(expandedVersion === v.id ? null : v.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">
                      {v.version_label}
                    </span>
                    {v.is_active && (
                      <Badge
                        variant="secondary"
                        className="bg-primary/20 text-primary text-xs"
                      >
                        Active
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        v.source === "user"
                          ? "border-blue-500/30 text-blue-400"
                          : "border-emerald-500/30 text-emerald-400",
                      )}
                    >
                      {v.source === "user" ? "User" : "AI"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(v.prep_time_minutes || 0) + (v.cook_time_minutes || 0)}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {v.servings}
                    </span>
                    {v.tokens_used && <span>{v.tokens_used} tok</span>}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedVersion === v.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    {v.ai_reasoning && (
                      <p className="text-sm text-white/60 italic">
                        {v.ai_reasoning}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-white/40">Difficulty: </span>
                        <span className="text-white">{v.difficulty}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Prep: </span>
                        <span className="text-white">
                          {v.prep_time_minutes ?? "—"}m
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40">Cook: </span>
                        <span className="text-white">
                          {v.cook_time_minutes ?? "—"}m
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-white/50">
                      {v.ingredients.length} ingredients · {v.steps.length}{" "}
                      steps
                    </div>

                    <div className="text-xs text-white/30">
                      Created{" "}
                      {new Date(v.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    {!v.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyVersion(v);
                        }}
                        className="gap-1.5 mt-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Use This Version
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
