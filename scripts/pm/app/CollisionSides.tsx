// DLV-176: a file both your checkout and the session changed, shown as its two
// sides against the run's base, so the owner can merge it by hand.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { read } from "./api";
import { ErrorNotice } from "./components";
import { PatchLines } from "./OwnerDiff";
import { client, pmKeys } from "./state";

type Side = "checkout" | "base";

function SidePatch({ runId, base, head, path, side }: { runId: string; base: string; head: string; path: string; side: Side }) {
  const query = useQuery(
    {
      queryKey: pmKeys.localComparison(runId, side, base, head, path),
      queryFn: ({ signal }) =>
        read<{ patch: string }>(
          "/api/delivery/v2/local/comparison?" +
            new URLSearchParams({ id: runId, head, against: side, path, ...(side === "base" ? { source: base } : {}) }),
          signal,
        ),
      // Your side is live: it changes as you edit.
      staleTime: side === "checkout" ? 0 : Infinity,
      retry: false,
    },
    client,
  );
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <p role="status">Reading file…</p>;
  return <PatchLines patch={query.data.patch} wrap />;
}

export function CollisionSides({ runId, base, head, label, paths }: {
  runId: string; base: string; head: string; label: string; paths: string[];
}) {
  const [selected, select] = useState(paths[0] ?? "");
  const path = paths.includes(selected) ? selected : paths[0];
  if (!path) return null;
  return (
    <section className="owner-diff collision-sides" aria-label="Both sides">
      <label className="owner-diff-file">
        <span>{paths.length === 1 ? "1 file" : paths.length + " files"}</span>
        <select aria-label="Colliding file" value={path} onChange={(event) => select(event.target.value)}>
          {paths.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
      </label>
      <h4>Your repo</h4>
      <SidePatch key={"checkout" + path} runId={runId} base={base} head={head} path={path} side="checkout" />
      <h4>{label}</h4>
      <SidePatch key={"base" + path} runId={runId} base={base} head={head} path={path} side="base" />
    </section>
  );
}
