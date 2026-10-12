import { eraArtifactHref } from "@/lib/era/artifacts";
import type { RunState } from "./state";

// Routes come from the shared entity registry, never from stored model prose.
export function runArtifacts(state: RunState) {
  return state.steps.flatMap((step) =>
    (step.result?.artifacts ?? []).map((a) => ({
      ...a,
      key: `${step.id}:${a.entity}:${a.id}:${a.action}`,
      route: eraArtifactHref(a),
    })),
  );
}
