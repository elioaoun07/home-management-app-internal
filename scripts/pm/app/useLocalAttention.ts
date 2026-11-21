import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalRunView } from "./LocalDelivery";
import { localRunAttention, type AttentionItem } from "./localRunAttention";
import type { LocalScene } from "./localRunScene";
import { liveness, type LocalPollHealth } from "./localRunLiveness";
import { TIMING } from "./stage/config";

/** A second tick renders the parent only when the liveness category changes. */
export function useRunHealth(run: LocalRunView, poll?: LocalPollHealth) {
  const [, renderBoundary] = useState(0);
  const state = useRef(liveness(run, Date.now(), poll).state);
  const health = liveness(run, Date.now(), poll);
  state.current = health.state;
  useEffect(() => {
    const timer = setInterval(() => {
      const next = liveness(run, Date.now(), poll).state;
      if (next !== state.current) {
        state.current = next;
        renderBoundary((value) => value + 1);
      }
    }, TIMING.second);
    return () => clearInterval(timer);
  }, [run, poll]);
  return health;
}
export function useLocalAttention(run: LocalRunView, state: string) {
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("pm-local-attention:" + run.run_id) || "[]",
      );
      return new Set(
        Array.isArray(value)
          ? value.filter(
              (id): id is string =>
                typeof id === "string" && id.startsWith(run.run_id + ":"),
            )
          : [],
      );
    } catch {
      return new Set();
    }
  });
  const attention = useMemo(
    () => ({ state, items: localRunAttention(run, seen, Date.now()) }),
    [run, seen, state],
  );
  const acknowledge = useCallback(
    (id: string, done = true) =>
      setSeen((previous) => {
        const next = new Set(previous);
        if (done) next.add(id);
        else next.delete(id);
        try {
          localStorage.setItem(
            "pm-local-attention:" + run.run_id,
            JSON.stringify([...next]),
          );
        } catch {
          /* View preferences are optional. */
        }
        return next;
      }),
    [run.run_id],
  );
  return { attention: attention.items, acknowledge, seen };
}

/** Advancing a replay clock inside a silent gap cannot invalidate the rail. */
export function useAttentionProjection(
  run: LocalRunView,
  scene: LocalScene,
  at: number | null,
  state: string,
  seen: Set<string>,
  real: AttentionItem[],
) {
  const cache = useRef<{
    key: string;
    source: LocalRunView;
    seen: Set<string>;
    items: AttentionItem[];
  } | null>(null);
  if (at === null) return real;
  const key = [
    scene.latest?.id,
    scene.phase,
    state,
    scene.run.head,
    scene.run.reviewed_head,
    scene.run.handover?.acceptance.state,
  ].join("|");
  if (
    !cache.current ||
    cache.current.key !== key ||
    cache.current.source !== run ||
    cache.current.seen !== seen
  )
    cache.current = {
      key,
      source: run,
      seen,
      items: localRunAttention(scene.run, seen, at),
    };
  return cache.current.items;
}
