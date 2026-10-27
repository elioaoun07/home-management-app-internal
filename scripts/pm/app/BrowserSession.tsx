import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { v2Pair } from "./api";
import { client, pmKeys, useWorld } from "./state";
import { transport } from "./transport";
import { ErrorNotice } from "./components";

/** Shared by Delivery, settings and direct UAT links. Pairing is not connectivity. */
export function useV2Session() {
  const { connected } = useWorld();
  return useQuery({
    queryKey: pmKeys.v2session,
    queryFn: ({ signal }) => transport().v2Session(signal),
    enabled: connected,
  });
}

export function PairV2() {
  const [code, setCode] = useState("");
  const pair = useMutation({
    mutationFn: () => v2Pair(code.trim()),
    onSuccess: () => {
      setCode("");
      void client.invalidateQueries({ queryKey: pmKeys.all });
    },
  });
  return (
    <form className="gate-panel" onSubmit={(event) => { event.preventDefault(); pair.mutate(); }}>
      <span className="eyebrow">Delivery</span>
      <h2>Pair this browser</h2>
      <p className="review-meta">Get a code: <code>pnpm pm:pair</code></p>
      <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" /></label>
      <ErrorNotice error={pair.error} />
      <div className="gate-actions">
        <button className="primary" disabled={!code.trim() || pair.isPending}>Pair</button>
      </div>
    </form>
  );
}
