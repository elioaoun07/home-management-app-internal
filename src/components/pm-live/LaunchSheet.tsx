// src/components/pm-live/LaunchSheet.tsx
// Launch flow: pick item -> flight-check (preflight command) -> lane +
// envelope -> launch. Every guard (flight-check review, budget envelope,
// dirty-tree/red-baseline refusal, drift check, build lock) is enforced
// server-side by startSession() via the bridge — this component only shapes
// the request and surfaces the server's own refusal reasons.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { displayText } from "@/features/pm-live/derive";
import { useFleet, useTasks } from "@/features/pm-live/store";
import type { LaneDefault, PmTask, SendCommand } from "@/features/pm-live/types";

const LANES = ["FAST", "STANDARD", "DEEP"] as const;
type Lane = (typeof LANES)[number];

// Used only until the fleet snapshot arrives with the laptop's real
// laneDefaults. Previously this WAS the source of truth on mobile and drifted
// silently from scripts/delivery/config.mjs whenever the owner customized
// .delivery/config.json.
const FALLBACK_LANE_USD: Record<Lane, number> = { FAST: 0.5, STANDARD: 2, DEEP: 5 };

type Step = "pick" | "checking" | "blocked" | "configure" | "launching" | "launched" | "error";

interface PreflightResult {
  preflight: { preflightId: string; dirtyAtStart: boolean; baselineValidation: { ok: boolean } };
  recommendation: {
    recommendation: { model: string; tier: string; estCostUsd: number | null } | null;
    preview: { recommendedLane: Lane; capabilities?: { name: string }[]; riskFlags?: string[] };
  } | null;
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <span className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--pm-border-strong)", borderTopColor: "transparent" }} />
      <p className="text-[14px]" style={{ color: "var(--pm-fg-2)" }}>
        {label}
      </p>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "warn" | "ok"; title: string; children: React.ReactNode }) {
  const color = tone === "warn" ? "var(--pm-warn)" : "var(--pm-accent)";
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: tone === "warn" ? "var(--pm-warn-soft)" : "var(--pm-accent-soft)" }}>
      <p className="text-[14.5px] font-medium mb-1" style={{ color }}>
        {title}
      </p>
      <div className="text-[13.5px]" style={{ color: "var(--pm-fg-2)" }}>
        {children}
      </div>
    </div>
  );
}

export function LaunchSheet({
  initialTask,
  onClose,
  sendCommand,
}: {
  /** Set when opened from a checklist row — skips the picker and flight-checks that item straight away. */
  initialTask?: PmTask | null;
  onClose: () => void;
  sendCommand: SendCommand;
}) {
  const tasks = useTasks();
  const fleet = useFleet();
  const [step, setStep] = useState<Step>(initialTask ? "checking" : "pick");
  const [selected, setSelected] = useState<PmTask | null>(initialTask || null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [lane, setLane] = useState<Lane>("STANDARD");
  const [envelope, setEnvelope] = useState("2");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const laneUsd = useMemo<Record<Lane, number>>(() => {
    const defaults = fleet?.laneDefaults;
    if (!defaults) return FALLBACK_LANE_USD;
    const pick = (key: "fast" | "standard" | "deep", fallback: number) =>
      (defaults[key] as LaneDefault | undefined)?.maxUsd ?? fallback;
    return { FAST: pick("fast", 0.5), STANDARD: pick("standard", 2), DEEP: pick("deep", 5) };
  }, [fleet]);

  const eligible = useMemo(() => (tasks?.tasks || []).filter((t) => t.state === "open" && t.idChip), [tasks]);

  // Opened from a checklist row: run the flight check immediately. The ref
  // keeps React 19 StrictMode's double-invoked effect from queueing two
  // preflight commands (each one runs the baseline validation on the laptop).
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!initialTask || autoChecked.current) return;
    autoChecked.current = true;
    pick(initialTask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask]);

  async function pick(task: PmTask) {
    setSelected(task);
    setStep("checking");
    const outcome = await sendCommand("preflight", { file: task.file, cbidx: task.cbidx, agent: "claude" });
    if (!outcome.ok || !outcome.result) {
      setErrorMsg(outcome.error || "flight check failed");
      setStep("error");
      return;
    }
    const result = outcome.result as unknown as PreflightResult;
    setPreflight(result);
    if (result.preflight.dirtyAtStart || !result.preflight.baselineValidation.ok) {
      setStep("blocked");
      return;
    }
    const recommendedLane = result.recommendation?.preview?.recommendedLane;
    if (recommendedLane) {
      setLane(recommendedLane);
      setEnvelope(String(laneUsd[recommendedLane] ?? 2));
    }
    setStep("configure");
  }

  async function launch() {
    if (!selected || !preflight) return;
    const maxUsd = Number(envelope);
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
      setErrorMsg("enter a positive dollar envelope");
      return;
    }
    setStep("launching");
    const outcome = await sendCommand(
      "launch",
      {
        file: selected.file,
        cbidx: selected.cbidx,
        expectText: selected.lineText,
        agent: "claude",
        model: preflight.recommendation?.recommendation?.model || undefined,
        preflightId: preflight.preflight.preflightId,
        flightCheck: { reviewed: true, lane },
        budget: { maxUsd },
      },
      { timeoutMs: 60_000 },
    );
    if (!outcome.ok) {
      setErrorMsg(outcome.error || "launch failed");
      setStep("error");
      return;
    }
    setSessionId((outcome.result?.sessionId as string) || null);
    setStep("launched");
  }

  return (
    <Sheet
      title="New delivery session"
      subtitle={selected?.idChip || undefined}
      onClose={onClose}
      footer={
        step === "configure" ? (
          <button onClick={launch} data-variant="primary" className="pm-btn w-full">
            Launch
          </button>
        ) : undefined
      }
    >
      {step === "pick" && (
        <div className="space-y-2">
          <p className="text-[14px] mb-3" style={{ color: "var(--pm-fg-2)" }}>
            Pick an item to deliver.
          </p>
          {eligible.map((t) => (
            <button key={`${t.file}::${t.cbidx}`} onClick={() => pick(t)} className="pm-card w-full text-left px-3.5 py-3">
              <span className="text-[12px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
                {t.idChip} · {t.module}
              </span>
              <span className="block text-[14.5px] mt-0.5" style={{ color: "var(--pm-fg-1)" }}>
                {displayText(t)}
              </span>
            </button>
          ))}
          {!eligible.length && (
            <p className="text-[14px]" style={{ color: "var(--pm-fg-3)" }}>
              No open, ID-tagged items found.
            </p>
          )}
        </div>
      )}

      {step === "checking" && <Spinner label="Running flight check…" />}
      {step === "launching" && <Spinner label="Launching…" />}

      {step === "blocked" && (
        <Notice tone="warn" title="Launch from the laptop">
          {preflight?.preflight.dirtyAtStart
            ? "The working tree has uncommitted changes. Acknowledging that requires the laptop's typed confirmation."
            : "The baseline validation is red. Authorizing a delta-based validation requires the laptop's typed confirmation."}
        </Notice>
      )}

      {step === "configure" && selected && preflight && (
        <div className="space-y-5">
          <div>
            <span className="text-[12px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
              {selected.idChip} · {selected.module}
            </span>
            <p className="text-[14.5px] mt-0.5" style={{ color: "var(--pm-fg-1)" }}>
              {displayText(selected)}
            </p>
          </div>

          {preflight.recommendation?.recommendation && (
            <p className="text-[13px]" style={{ color: "var(--pm-fg-2)" }}>
              Recommended: {preflight.recommendation.recommendation.tier} · {preflight.recommendation.recommendation.model}
              {preflight.recommendation.recommendation.estCostUsd != null &&
                ` · ~$${preflight.recommendation.recommendation.estCostUsd.toFixed(2)}`}
            </p>
          )}
          {!!preflight.recommendation?.preview?.riskFlags?.length && (
            <p className="text-[13px]" style={{ color: "var(--pm-warn)" }}>
              Risk: {preflight.recommendation.preview.riskFlags.join(", ")}
            </p>
          )}

          <div>
            <p className="text-[13px] mb-1.5" style={{ color: "var(--pm-fg-2)" }}>
              Lane
            </p>
            <div className="flex gap-2">
              {LANES.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLane(l);
                    setEnvelope(String(laneUsd[l]));
                  }}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-medium border"
                  style={
                    lane === l
                      ? { backgroundColor: "var(--pm-accent-soft)", color: "var(--pm-accent)", borderColor: "var(--pm-accent-border)" }
                      : { backgroundColor: "var(--pm-surface)", color: "var(--pm-fg-2)", borderColor: "transparent" }
                  }
                >
                  {l}
                  {preflight.recommendation?.preview?.recommendedLane === l && " ★"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] mb-1.5" style={{ color: "var(--pm-fg-2)" }}>
              Budget envelope ($, required)
            </p>
            {/* Hard Rule 19: never type="number" on a money field. */}
            <input
              type="text"
              inputMode="decimal"
              value={envelope}
              onChange={(e) => setEnvelope(e.target.value)}
              className="pm-input text-[16px]"
              placeholder="2.00"
            />
          </div>

          {errorMsg && (
            <p className="text-[13px]" style={{ color: "var(--pm-warn)" }}>
              {errorMsg}
            </p>
          )}
        </div>
      )}

      {step === "launched" && (
        <Notice tone="ok" title="Launched">
          {sessionId && <p className="font-mono text-[13px]">{sessionId}</p>}
          <button onClick={onClose} className="mt-3 text-[14px] underline" style={{ color: "var(--pm-fg-2)" }}>
            Done
          </button>
        </Notice>
      )}

      {step === "error" && (
        <Notice tone="warn" title="Couldn't launch">
          <p>{errorMsg}</p>
          <button onClick={() => setStep("pick")} className="mt-3 text-[14px] underline" style={{ color: "var(--pm-fg-2)" }}>
            Back
          </button>
        </Notice>
      )}
    </Sheet>
  );
}
