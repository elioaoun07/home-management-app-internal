import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Square, Trash2, X } from "lucide-react";
import type { LocalAct, LocalRunView } from "./LocalDelivery";
import { read } from "./api";
import { pmKeys } from "./state";

const WORKING = ["preparing", "building", "checking", "accepting"];
/** Phases the server lets the owner discard one by one (`local-storage.mjs#eligible`). */
const DISCARDABLE = ["uat-ready", "refresh-conflict", "refresh-failed", "failed", "cancelled", "stopped"];

export type StopMode = "cancel" | "stop" | "discard" | null;
/** One top-bar exit per run: stop it while it works, discard it once it rests. */
export function stopMode(run: Pick<LocalRunView, "phase" | "canStop" | "cleaned_at" | "merge_pending">): StopMode {
  if (WORKING.includes(run.phase)) return "cancel";
  if (run.phase === "acceptance-paused" && run.canStop) return "stop";
  if (DISCARDABLE.includes(run.phase) && !run.cleaned_at && !run.merge_pending) return "discard";
  return null;
}

type Preview = { runs: { run_id: string; witness: string }[]; blocked?: { run_id: string; reason: string }[] };

/** Stopping or discarding deletes the worktree and its branch; the diff stays archived. */
export function LocalStopControl({ run, busy, act, className = "" }: { run: LocalRunView; busy: boolean; act: LocalAct; className?: string }) {
  const [confirming, setConfirming] = useState(false);
  const mode = stopMode(run);
  const preview = useQuery({
    queryKey: pmKeys.localStoragePreview(run.run_id),
    queryFn: ({ signal }) => read<Preview>(`/api/delivery/v2/local/storage?run_id=${encodeURIComponent(run.run_id)}`, signal),
    enabled: confirming && mode === "discard",
    staleTime: 0,
  });
  if (!mode) return null;
  const discard = mode === "discard";
  const witness = preview.data?.runs.find(entry => entry.run_id === run.run_id)?.witness;
  const blocked = preview.data && !witness
    ? preview.data.blocked?.find(entry => entry.run_id === run.run_id)?.reason || "Nothing to delete" : null;
  const confirm = () => {
    setConfirming(false);
    if (mode === "discard") { if (witness) act("discard", { witness }); }
    else act(mode, mode === "stop" && run.head ? { expected_head: run.head } : undefined);
  };
  if (!confirming)
    return <button type="button" className={`local-stop ${className}`} disabled={busy} title={run.workspace}
      aria-label={discard ? "Discard" : "Stop"} onClick={() => setConfirming(true)}>
      {discard ? <Trash2 size={15} /> : <Square size={14} />}<span>{discard ? "Discard" : "Stop"}</span>
    </button>;
  return <span className={`local-stop-confirm ${className}`} role="group" aria-label={discard ? "Confirm discard" : "Confirm stop"}>
    {blocked ? <small role="status">{blocked}</small> :
      <button type="button" className="local-stop local-stop-danger" title={run.workspace}
        aria-label={discard ? "Delete worktree" : "Stop and delete worktree"}
        disabled={busy || (discard && (!witness || preview.isFetching))} onClick={confirm} autoFocus>
        <Trash2 size={15} /><span>{discard ? "Delete worktree" : "Stop + delete worktree"}</span>
      </button>}
    <button type="button" className="local-stop local-stop-keep" aria-label="Keep" title="Keep" onClick={() => setConfirming(false)}>
      <X size={15} />
    </button>
  </span>;
}
