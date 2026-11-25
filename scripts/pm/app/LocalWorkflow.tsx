import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LocalAct } from "./LocalDelivery";
import { read } from "./api";
import { ErrorNotice } from "./components";
import { SetupDeliveryPush } from "./SetupDeliveryPush";
import { CollisionSides } from "./CollisionSides";
import { localRunLabel, localRunStages, type WorkflowRun } from "./localRunModel";
import { pmKeys } from "./state";
import { needsManualCommit, type OwnerStation } from "./ownerStations";

export function GitCommands({ commands, stdin }: { commands?: string[][]; stdin?: string | null }) {
  if (!commands?.length) return null;
  return <pre className="local-git-commands" aria-label="Commands">{commands.map(argv =>
    argv.map(arg => /^[A-Za-z0-9@/_.=:+-]+$/u.test(arg) ? arg : JSON.stringify(arg)).join(" ")
  ).join("\n")}{stdin && <><br /><small>stdin</small><br />{stdin.trimEnd()}</>}</pre>;
}

function CleanupPreview({ id, busy, act, label }: { id: string; busy: boolean; act: LocalAct; label: string }) {
  const preview = useQuery({
    queryKey: pmKeys.localStoragePreview(id),
    queryFn: ({ signal }) => read<{ runs: { run_id: string; workspace: string; witness: string; commands: string[][]; branchInput?: string | null; remainder?: string | null }[]; blocked?: { run_id: string; reason: string }[] }>(
      `/api/delivery/v2/local/storage?run_id=${encodeURIComponent(id)}`, signal),
    staleTime: 0,
  });
  if (preview.isPending) return <p role="status">Checking files…</p>;
  if (preview.error) return <ErrorNotice error={preview.error} retry={() => void preview.refetch()} />;
  const item = preview.data?.runs.find(entry => entry.run_id === id);
  if (!item) return <p role="status">{preview.data?.blocked?.find(entry => entry.run_id === id)?.reason || "No eligible worktree"}</p>;
  return <div className="local-command-preview">
    <code>{item.workspace}</code>
    {item.remainder && <p>Archive remaining files in <code style={{ overflowWrap: "anywhere" }}>{item.remainder}</code></p>}
    <GitCommands commands={item.commands} stdin={item.branchInput} />
    <button className="primary" disabled={busy || !item.witness || preview.isFetching} onClick={() => act("discard", { witness: item.witness })}>{label}</button>
  </div>;
}

export function LocalSteps({ run }: { run: WorkflowRun }) {
  return <ol className="local-workflow-steps" aria-label="Delivery stages">
    {localRunStages(run).map(step => <li key={step.label} data-stage-state={step.state}
      aria-current={step.state === "current" || step.state === "stopped" ? "step" : undefined}>{step.label}</li>)}
  </ol>;
}

export function LocalActions({ run, busy, act, station, reviewAvailable = false, onSelectStation }: {
  run: WorkflowRun; busy: boolean; act: LocalAct; station?: OwnerStation | "session"; reviewAvailable?: boolean;
  onSelectStation?: (station: OwnerStation) => void;
}) {
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [recheckedAt, setRecheckedAt] = useState<string | null>(null);
  const at = (id: OwnerStation | "session") => !station || station === id;
  const publication = run.publication;
  const needsDestination = publication?.action === "push" && (
    publication.reason === "Set the push destination in Setup" ||
    publication.reason === "Internal's URL changed. Review the destination in Setup."
  );
  const plan = run.mergePlan;
  const resumeMerge = !!run.merge_pending && !!run.canMerge;
  const conflicts = plan?.conflicts ?? [];
  const inConflict = !resumeMerge && !!(conflicts.length || run.refresh?.conflicts?.length || run.phase === "refresh-conflict");
  const refreshable = !resumeMerge && !!(plan?.canRefresh && plan.refreshBase && run.head);
  const offBranch = !!plan && plan.branch !== plan.expected && !plan.error;
  const stopped = ["failed", "cancelled", "stopped", "reverted", "shipped", "push-pending", "revert-push-pending"].includes(run.phase);
  const testReady = !inConflict && !offBranch && run.phase === "uat-ready" && !!run.handover && !run.canMerge && run.handover.acceptance.state !== "accepted";
  const needsReview = !inConflict && !offBranch && run.phase === "uat-ready" && !testReady && !!run.risk?.required && run.reviewed_head !== run.head && !run.canMerge;
  const optionalReview = station === "review" && !run.risk?.required && run.phase === "uat-ready" &&
    !run.merge_pending && !inConflict && !offBranch && !testReady && !!run.head && run.reviewed_head !== run.head;
  const publishedLocally = run.phase === "merged" || run.phase === "committed";
  const showCleanup = !run.merge_pending && !run.cleaned_at && !!run.run_id && (
    stopped || inConflict || !!run.pushed || run.phase === "refresh-failed" || run.phase === "uat-ready" || publishedLocally
  );
  const cleanLabel = run.pushed ? "Clean up" : publishedLocally ? "Discard worktree" : "Discard";
  // DLV-176: files merged by hand that still need the owner's eye.
  const toResolve = (run.applied?.by_hand ?? []).filter(file => file.conflicts > 0 || file.kept);
  return <section className="local-workflow" aria-label="Session actions">
    {!station && <><LocalSteps run={run} /><h3 aria-live="polite">{localRunLabel(run)}</h3></>}
    <div className="gate-actions">
      {run.activeCommand && <span role="status">{run.activeCommand} in progress…</span>}
      {at("cleanup") && run.cleanup_error && !run.cleaned_at && <p className="merge-note merge-alert">Cleanup pending · {run.cleanup_error}</p>}
      {at("merge") && inConflict && <div className="merge-note merge-alert" role="alert"><strong>Changed files</strong><ul>
        {(conflicts.length ? conflicts.map(file => ({ path: file.path, dirty: file.uncommitted })) : (run.refresh?.conflicts ?? []).map(path => ({ path, dirty: false }))).map(file =>
          <li key={file.path}><code>{file.path}</code>{file.dirty && " · uncommitted"}</li>)}</ul></div>}
      {at("merge") && inConflict && !!conflicts.length && run.run_id && run.base && run.head &&
        <CollisionSides runId={run.run_id} base={run.base} head={run.head} label={(run.work?.id ?? "This") + " session"}
          paths={conflicts.map(file => file.path)} />}
      {at("merge") && !!run.canMergeByHand && <button className="primary" disabled={busy} onClick={() => act("merge-by-hand")}
        title="Both sides kept; overlaps get conflict markers">Merge by hand</button>}
      {(at("merge") || at("commit")) && !!toResolve.length && <div className="merge-note" role="status"><strong>Resolve in your editor</strong><ul>
        {toResolve.map(file => <li key={file.path}><code>{file.path}</code>{file.kept ? " · kept yours" : " · " + file.conflicts + " conflict" + (file.conflicts === 1 ? "" : "s")}</li>)}</ul></div>}
      {at("merge") && offBranch && <p className="merge-note merge-alert">Switch to {plan?.expected}</p>}
      {at("merge") && plan?.error && <p className="merge-note merge-alert">{plan.error}</p>}
      {at("merge") && run.applied?.pm_error && <p className="merge-note merge-alert">PM update · {run.applied.pm_error}</p>}
      {at("merge") && !!plan && !resumeMerge && run.phase === "uat-ready" && !plan.files.length && !plan.error && <p className="merge-note">No changes to merge</p>}
      {publication && at(publication.action) && <div className="local-command-preview">
        {!!publication.files.length && <ul aria-label="Files to commit">{publication.files.map(path => <li key={path}><code>{path}</code></li>)}</ul>}
        {!!publication.outgoing?.length && <ul aria-label="Outgoing commits">{publication.outgoing.map(sha => <li key={sha}><code>{sha}</code></li>)}</ul>}
        <GitCommands commands={publication.commands} />
        {!!publication.cleanupCommands?.length && <><strong>After push</strong><GitCommands commands={publication.cleanupCommands} stdin={publication.cleanupInput} /></>}
        {needsDestination && typeof window !== "undefined" ? <SetupDeliveryPush /> : publication.reason && <p role="status">{station === "commit" && needsManualCommit(run) ? "This merge has no verified file list. Commit manually." : publication.reason}{needsDestination && <> · <a href="#/setup">Open Setup</a></>}</p>}
        {onSelectStation && station === "commit" && needsManualCommit(run) ? <button className="secondary" onClick={() => onSelectStation("review")}>Review changes</button> :
          !needsDestination && <button className="primary" disabled={busy || !publication.token || !!publication.reason} onClick={() => publication.token && act(publication.action, { preview_id: publication.token })}>
          {publication.action === "push" ? publication.recover ? "Verify push" : "Push" : publication.recover ? "Verify commit" : "Commit"}
        </button>}
      </div>}
      {at("test") && testReady && <button className="primary" disabled={busy} onClick={() => act("test")}>Test steps</button>}
      {at("review") && (needsReview || optionalReview) && <button className="primary" disabled={busy || !run.head || (!!station && !reviewAvailable)} onClick={() => act("review", run.head ? { expected_head: run.head } : undefined)}>{station ? "Mark reviewed" : "Review diff"}</button>}
      {at("merge") && (resumeMerge || (run.phase === "uat-ready" && !testReady && !needsReview && !inConflict)) && <button className="primary" disabled={busy || !run.canMerge} onClick={() => act("merge")}>{resumeMerge ? "Resume merge" : "Merge"}</button>}
      {at("merge") && refreshable && <div className="local-command-preview">
        <GitCommands commands={plan?.refreshCommands?.slice(0, 1)} />
        {(plan?.refreshCommands?.length ?? 0) > 1 && <><small>On rebase conflict</small><GitCommands commands={plan?.refreshCommands?.slice(1)} /></>}
        <button className="primary" disabled={busy} onClick={() => act("refresh", { expected_base: plan!.refreshBase!, expected_head: run.head! })}>
          {plan?.refreshCommands?.length === 0 ? "Retry checks" : "Refresh"}
        </button></div>}
      {at("merge") && (inConflict || offBranch || run.phase === "refresh-failed" || (run.phase === "uat-ready" && !run.canMerge && !testReady && !needsReview)) &&
        <><button className="secondary" disabled={busy} onClick={() => { act("recheck"); setRecheckedAt(new Date().toLocaleTimeString()); }}>Recheck</button>
          {recheckedAt && <small role="status">Checked {recheckedAt}</small>}</>}
      {at("session") && ["preparing", "building", "checking", "accepting"].includes(run.phase) && <>
        {!!run.cancelCleanupCommands?.length && <details><summary>Cancel commands</summary>
          <GitCommands commands={run.cancelCleanupCommands} /><small>Delete {run.branch} at its archived commit.</small>
        </details>}
        <button className="secondary" disabled={busy} onClick={() => act("cancel")}>Cancel</button>
      </>}
      {at("push") && (run.phase === "push-pending" || run.phase === "revert-push-pending") && <p className="merge-note">Legacy push needs manual review</p>}
      {!station && run.committed && <small><code>{run.committed.sha.slice(0, 12)}</code>{run.pushed && ` · ${run.pushed.remote}/${run.pushed.branch}`}</small>}
      {(at("commit") || at("push")) && !!run.publication_log?.length && <details className="local-command-preview"><summary>Command history</summary>
        {run.publication_log.map((entry, index) => <div key={index}>
          <GitCommands commands={[entry.argv]} /><small>Exit {entry.exit ?? "unknown"}</small>{entry.tail && <pre>{entry.tail}</pre>}
        </div>)}</details>}
      {at("cleanup") && showCleanup && <details onToggle={event => setCleanupOpen(event.currentTarget.open)}>
        <summary>{cleanLabel}</summary>{cleanupOpen && <CleanupPreview id={run.run_id!} busy={busy} act={act} label={cleanLabel} />}
      </details>}
    </div>
  </section>;
}
