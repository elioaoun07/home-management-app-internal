import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isLoopbackOrigin } from "../../delivery-v2/local-auth-browser.mjs";
import { read, v2Post } from "./api";
import { PairV2, useV2Session } from "./BrowserSession";
import { Back, ErrorNotice } from "./components";
import { client, go, pmKeys } from "./state";
import { transport } from "./transport";
import type { UatHandover, Work } from "./types";

export const offersLocalLane = () => transport().capabilities.kind === "local" && isLoopbackOrigin(location.origin);
export interface LocalReadiness {
  ready: boolean;
  facts: Record<string, { state: string; code: string; detail?: string }>;
}
export interface LocalRunView {
  run_id: string; phase: string; workspace: string; branch: string; head: string | null; current_head: string | null;
  canShip: boolean; canUndo: boolean; interrupted: boolean; error?: string;
  work: { id: string; title: string }; risk?: { required: boolean; flagged: { path: string; domains: string[] }[] };
  checks: { name: string; exit: number | null; stdout: string; stderr: string; error: string | null }[];
  activity: { at: string; summary: string | null }[];
  usage: Record<string, number | string | null> | null;
  handover: UatHandover | null;
}

export function LocalReadinessPanel({ data }: { data: LocalReadiness }) {
  const labels: Record<string, string> = { source: "Source", authentication: "Sign-in", environment: "Dependencies", coordination: "Sessions", modelAvailability: "Model", budget: "Usage" };
  return <section className="launch-readiness" aria-label="Local readiness">
    <ul className="launch-check-list">{Object.entries(data.facts).map(([name, fact]) => <li key={name}>
      <span>{labels[name] || name}</span><small>{fact.state === "pass" ? "Passed" : fact.state === "advisory" ? `Advisory · ${fact.code.replaceAll("-", " ")}` : fact.code.replaceAll("-", " ")}</small>
    </li>)}</ul>
  </section>;
}

export function LocalLaunch({ work }: { work: Work }) {
  const [executor, setExecutor] = useState("claude");
  const session = useV2Session();
  const readiness = useQuery({ queryKey: pmKeys.localReadiness(executor),
    queryFn: ({ signal }) => read<LocalReadiness>(`/api/delivery/v2/local/readiness?executor=${executor}`, signal),
    enabled: !!session.data?.paired, refetchInterval: 15_000 });
  const start = useMutation({ mutationFn: () => v2Post<{ run_id: string }>("local", { action: "start", id: work.idChip || work.id, file: work.file, executor }, 120_000),
    onSuccess: result => go(`/delivery/run/${result.run_id}`), onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }) });
  if (session.data && !session.data.paired) return <PairV2 />;
  return <div className="focus-page launch-page"><Back fallback="/delivery" />
    <header className="launch-heading"><span className="eyebrow">{work.idChip || work.id} · Local</span><h1>{work.title}</h1></header>
    <label>Executor<select value={executor} onChange={event => setExecutor(event.target.value)}><option value="claude">Claude</option><option value="codex">Codex</option></select></label>
    <ErrorNotice error={readiness.error || start.error} />
    {readiness.data && <LocalReadinessPanel data={readiness.data} />}
    <div className="gate-actions"><button className="primary" disabled={!readiness.data?.ready || start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Starting…" : "Start"}</button>
      <a className="secondary" href={`${location.hash}${location.hash.includes("?") ? "&" : "?"}lane=confined`}>Confined</a></div>
    <HostLimits />
  </div>;
}

function HostLimits() {
  return <details><summary>Host limits</summary><p>Credential scrub prevents accidents, not deliberate host access.</p></details>;
}

export function LocalActions({ run, busy, act }: { run: Pick<LocalRunView, "phase" | "head" | "canShip" | "canUndo" | "interrupted" | "handover">; busy: boolean; act: (action: "review" | "ship" | "undo" | "cancel") => void }) {
  return <div className="gate-actions">
    <button className="secondary" disabled={busy || !run.head} onClick={() => act("review")}>Review diff</button>
    {run.handover && <a className="secondary" href={`#/delivery/test/${run.handover.handover_id}`}>Test steps</a>}
    <button className="primary" disabled={busy || !(run.canShip || run.phase === "push-pending")} onClick={() => act("ship")}>{run.phase === "push-pending" ? "Retry push" : "Ship"}</button>
    {(run.canUndo || run.phase === "revert-push-pending") && <button className="secondary" disabled={busy} onClick={() => act("undo")}>Undo</button>}
    {["building", "checking"].includes(run.phase) && !run.interrupted && <button className="secondary" disabled={busy} onClick={() => act("cancel")}>Cancel</button>}
  </div>;
}

export function LocalRun({ id }: { id: string }) {
  const session = useV2Session();
  const [patch, setPatch] = useState<string | null>(null);
  const detail = useQuery({ queryKey: pmKeys.localRun(id), queryFn: ({ signal }) => read<LocalRunView>(`/api/delivery/v2/local/run?id=${encodeURIComponent(id)}`, signal),
    enabled: !!session.data?.paired && offersLocalLane(), refetchInterval: 4000 });
  const command = useMutation({ mutationFn: (action: "review" | "ship" | "undo" | "cancel") => v2Post<{ patch?: string }>("local", { action, run_id: id }, 120_000),
    onSuccess: result => { if (result.patch !== undefined) setPatch(result.patch); },
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }) });
  const run = detail.data;
  if (session.data && !session.data.paired) return <PairV2 />;
  if (!offersLocalLane()) return <p>Open on the laptop</p>;
  return <div className="focus-page" style={{ minWidth: 0, overflowWrap: "anywhere" }}><Back fallback="/delivery" /><ErrorNotice error={detail.error || command.error} />
    {run && <><header className="launch-heading"><span className="eyebrow">{run.work.id} · Local</span><h1>{run.work.title}</h1><p role="status">{run.interrupted ? "Interrupted · inspect session" : run.phase}</p></header>
      {run.error && <p role="alert">{run.error}</p>}
      <code>{run.branch}</code>
      <details><summary>Worktree</summary><code style={{ overflowWrap: "anywhere" }}>{run.workspace}</code></details>
      <LocalActions run={run} busy={command.isPending} act={action => command.mutate(action)} />
      {run.risk?.required && <details><summary>Review required</summary><ul>{run.risk.flagged.map(file => <li key={file.path}><code>{file.path}</code> · {file.domains.join(", ")}</li>)}</ul></details>}
      {patch !== null && <pre style={{ overflow: "auto", maxHeight: "60vh", maxWidth: "100%" }}>{patch}</pre>}
      <section><h2>Checks</h2>{run.checks.map(check => <details key={check.name}><summary>{check.name} · {check.exit === 0 ? "Passed" : "Failed"}</summary><pre style={{ overflow: "auto" }}>{check.stdout}{check.stderr}{check.error}</pre></details>)}</section>
      <section><h2>Activity</h2>{run.activity.slice(-30).map((entry, index) => <p key={index}>{entry.summary}</p>)}</section><HostLimits />
      {run.usage && <details><summary>Usage</summary><dl>{Object.entries(run.usage).filter(([, value]) => typeof value === "number").map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>}
    </>}
  </div>;
}
