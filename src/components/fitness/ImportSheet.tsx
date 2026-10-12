"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shared/Sheet";
import { FitnessApiError, useImportPlan } from "@/features/fitness/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { prescriptionLabel } from "@/lib/fitness/format";
import { buildPtConversionPrompt, parsePtPlanText, ptPlanJsonSchema, slotTitle, weeklyTrainingTarget, type ParsedImport } from "@/lib/fitness/ptPlan";
import { cn } from "@/lib/utils";
import { AlertTriangle, ClipboardCopy, FileJson, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Pill, PrimaryButton } from "./fitnessUi";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Import as a new version of this plan instead of a new plan. */
  planId?: string;
  onOpenExisting: (planId: string) => void;
}

export function ImportSheet({ open, onClose, planId, onOpenExisting }: Props) {
  const pal = useFitnessPalette();
  const tc = useThemeClasses();
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const importPlan = useImportPlan();
  // Validation and preview run locally (works offline); commit needs the network.
  const parsed: ParsedImport | null = useMemo(() => (text.trim() ? parsePtPlanText(text) : null), [text]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPtConversionPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };
  const downloadSchema = () => {
    const blob = new Blob([JSON.stringify(ptPlanJsonSchema(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "era-fitness-pt-plan.v1.schema.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setDuplicate(null);
  };
  const commit = () => {
    if (!parsed?.ok) return;
    importPlan.mutate(
      { content: parsed.raw, source_text: text, planId },
      {
        onSuccess: () => { setText(""); onClose(); },
        onError: (e) => {
          if (e instanceof FitnessApiError && e.status === 409 && e.body.reason === "duplicate" && e.body.existing) {
            setDuplicate(e.body.existing as { id: string; name: string });
            return;
          }
          toast.error(e instanceof FitnessApiError && e.status === 503 ? "Fitness setup pending" : e.message);
        },
      },
    );
  };

  const blocking = parsed?.ok ? parsed.issues.filter((i) => i.blocking) : [];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className={cn("rounded-t-3xl border-t", tc.bgPage, pal.line)}>
        <SheetHeader>
          <SheetTitle className={pal.ink}>{planId ? "New version" : "Import plan"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 mt-1">
          <GhostButton onClick={copyPrompt}><ClipboardCopy className="w-4 h-4" /> {copied ? "Copied" : "Copy AI prompt"}</GhostButton>
          <GhostButton onClick={() => file.current?.click()}><Upload className="w-4 h-4" /> .json</GhostButton>
          <GhostButton onClick={downloadSchema}><FileJson className="w-4 h-4" /> Schema</GhostButton>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setDuplicate(null); }}
          placeholder="Paste JSON"
          spellCheck={false}
          className={cn("mt-3 w-full h-36 rounded-2xl border p-3 font-mono text-xs bg-transparent outline-none resize-y", pal.line, pal.ink)}
          aria-label="Plan JSON"
        />

        {parsed && !parsed.ok && (
          <ul className="mt-3 space-y-1.5" aria-live="polite">
            {parsed.errors.map((e) => (
              <li key={e.id} className="text-xs flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span className={pal.mute}>
                  {e.path && <code className={cn("mr-1", pal.ink)}>{e.path}</code>}
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {parsed?.ok && (
          <div className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={cn("font-semibold", pal.ink)}>{parsed.plan.name}</p>
                <p className={cn("text-xs", pal.faint)}>
                  {[parsed.plan.trainer, parsed.plan.duration_weeks ? `${parsed.plan.duration_weeks} weeks` : null,
                    `${parsed.plan.workout_order.length}/week`, `${weeklyTrainingTarget(parsed.plan)} training`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {blocking.length ? <Pill tone="pending">Review {blocking.length}</Pill> : <Pill tone="accent">Ready</Pill>}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {parsed.plan.workout_order.map((_, i) => <Pill key={i}>{slotTitle(parsed.plan, i)}</Pill>)}
            </div>

            {parsed.issues.length > 0 && (
              <ul className="space-y-1.5">
                {parsed.issues.map((i) => (
                  <li key={i.id} className="text-xs flex gap-2">
                    <AlertTriangle className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", i.blocking ? "text-amber-400" : pal.faint)} />
                    <span className={pal.mute}><code className={cn("mr-1", pal.ink)}>{i.path}</code>{i.message}{i.source === "ai" ? " (AI)" : ""}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 max-h-[34vh] overflow-y-auto pr-1">
              {parsed.plan.workouts.map((w) => (
                <details key={w.id} className={cn("rounded-xl border px-3 py-2", pal.line)}>
                  <summary className={cn("text-sm font-medium cursor-pointer", pal.ink)}>
                    {w.name} <span className={cn("font-normal", pal.faint)}>· {w.kind} · {w.exercises.length}</span>
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {w.exercises.map((e) => (
                      <li key={e.id} className="text-xs">
                        <span className={pal.ink}>{e.name}</span>
                        <span className={pal.faint}> · {e.phase}{e.group_id ? ` · ${e.group_mode} ${e.group_id}` : ""}</span>
                        <span className={cn("block", pal.mute)}>{e.sets.length ? `${e.sets.length} × ${prescriptionLabel(e.sets[e.sets.length - 1])}` : "No sets"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        )}

        {duplicate ? (
          <div className="mt-4 flex gap-2">
            <GhostButton className="flex-1 h-12" onClick={() => setDuplicate(null)}>Back</GhostButton>
            <PrimaryButton className="flex-[2]" onClick={() => { onOpenExisting(duplicate.id); onClose(); }}>Open existing</PrimaryButton>
          </div>
        ) : (
          <PrimaryButton className="w-full mt-4" disabled={!parsed?.ok || importPlan.isPending} onClick={commit}>
            {planId ? "Save version" : "Import"}
          </PrimaryButton>
        )}
      </SheetContent>
    </Sheet>
  );
}
