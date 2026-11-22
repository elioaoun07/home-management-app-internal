import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { read, v2Post } from "./api";
import { client, pmKeys } from "./state";

type Run = { run_id: string; phase: string; title: string; workspace: string; commands: string[][]; branchInput: string | null; witness: string; remainder?: string | null };
type Storage = { worktrees: number; maxWorktrees: number; bytes: number | null; checkouts: { name: string; bytes: number; title?: string; run_id?: string }[]; runs: Run[]; blocked: {run_id: string; reason: string}[]; retained: Pick<Run, "run_id" | "title" | "phase">[] };
type CleanupResult = { cleaned: { run_id: string }[]; failed?: { run_id: string; reason: string }[] };
const endpoint = "/api/delivery/v2/local/storage";

export function SetupDeliveryStorage() {
  const [preview, setPreview] = useState<Storage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [disk, setDisk] = useState<Storage | null>(null);
  const summary = useQuery({ queryKey: pmKeys.localStoragePreview("setup"), queryFn: ({ signal }) => read<Storage>(endpoint + "?summary=1", signal) });
  const scan = useMutation({ mutationFn: () => read<Storage>(endpoint + "?summary=1&measure=1"), onSuccess: setDisk });
  const inspect = useMutation({ mutationFn: () => read<Storage>(endpoint), onSuccess: v => {
    setPreview(v);
    setSelected(v.runs.map(run => run.run_id));
  } });
  const clean = useMutation({ mutationFn: (runs: Run[]) => v2Post<CleanupResult>("local", { action: "cleanup", runs: runs.map(({ run_id, witness }) => ({ run_id, witness })) }, 15 * 60_000),
    onSettled: () => {
      setDisk(null); setPreview(null); setSelected([]);
      void client.invalidateQueries({ queryKey: pmKeys.all });
    } });
  const busy = inspect.isPending || clean.isPending || scan.isPending;
  const error = summary.error || scan.error || inspect.error || clean.error;
  return <section className="cockpit-panel">
    <h2>Delivery storage</h2>
    {summary.data && <p>{summary.data.worktrees} worktrees · limit {summary.data.maxWorktrees}</p>}
    {disk && disk.bytes !== null && <div>
      <p><strong>{(disk.bytes / 1048576).toFixed(1)} MiB retained</strong> · unique file sizes</p>
      {disk.checkouts.map(tree => <p key={tree.name}>
        {tree.run_id ? <a href={`#/delivery/run/${encodeURIComponent(tree.run_id)}`}>{tree.title || tree.name}</a> : tree.name}
        {" · "}{(tree.bytes / 1048576).toFixed(1)} MiB checkout
      </p>)}
    </div>}
    {!disk && summary.data && summary.data.worktrees >= summary.data.maxWorktrees && summary.data.retained.map(run =>
      <p key={run.run_id}><a href={`#/delivery/run/${encodeURIComponent(run.run_id)}`}>{run.title}</a> · {run.phase === "shipped" ? "Merged" : run.phase}</p>)}
    <div className="cockpit-tools">
      <button className="secondary" disabled={busy} onClick={() => scan.mutate()}>{scan.isPending ? "Measuring…" : "Measure disk"}</button>
      <button className="secondary" disabled={busy} onClick={() => { clean.reset(); inspect.mutate(); }}>{inspect.isPending ? "Checking…" : "Clean up closed runs"}</button>
    </div>
    {preview && <div>
      {!preview.runs.length && <p>No eligible runs</p>}
      {preview.runs.map(run => <div key={run.run_id}>
        <label><input type="checkbox" disabled={busy} checked={selected.includes(run.run_id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, run.run_id] : ids.filter(id => id !== run.run_id))} /> {run.title} · {run.phase}</label>
        <details><summary>Files and commands</summary><code>{run.workspace}</code>
          {run.remainder && <p>Archive remaining files in <code style={{ overflowWrap: "anywhere" }}>{run.remainder}</code></p>}
          {run.commands.map((argv, i) => <pre key={i} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(argv)}</pre>)}
          {run.branchInput && <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>stdin {run.branchInput}</pre>}
        </details>
      </div>)}
      {preview.blocked.map(run => <p key={run.run_id}>{run.run_id} · {run.reason}</p>)}
      {preview.runs.length > 0 && <button className="secondary" disabled={busy || !selected.length} onClick={() => clean.mutate(preview.runs.filter(run => selected.includes(run.run_id)))}>{clean.isPending ? "Cleaning…" : `Confirm cleanup (${selected.length})`}</button>}
    </div>}
    {clean.data && !preview && <p role="status">{clean.data.failed?.length
      ? `${clean.data.cleaned.length} cleaned · ${clean.data.failed.length} to retry` : "Cleanup complete"}</p>}
    {clean.data?.failed?.map(run => <p key={run.run_id} style={{ overflowWrap: "anywhere" }}>
      {clean.variables?.find(item => item.run_id === run.run_id)?.title || run.run_id} · {run.reason}
    </p>)}
    {error && <p role="alert">{error.message}</p>}
  </section>;
}
