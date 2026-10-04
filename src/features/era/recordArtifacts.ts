// src/features/era/recordArtifacts.ts
// The single place an ERA write becomes an Artifact row (era_actions, the
// /era Artifacts tab). Callers hand over whatever `artifacts` the adapter
// returned — no per-feature mapping lives here (see src/lib/era/artifacts.ts).
//
// Fire-and-forget: a failed log write must never break the user-visible
// reply, so this never throws and callers don't await it.
import { safeFetch } from "@/lib/safeFetch";
import type { EraArtifact } from "@/lib/era/artifacts";
import type { QueryClient } from "@tanstack/react-query";
import { eraKeys } from "./queryKeys";

export function recordEraArtifacts(
  artifacts: EraArtifact[] | undefined,
  queryClient?: QueryClient,
): void {
  if (!artifacts?.length) return;
  safeFetch("/api/era/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifacts }),
  })
    .then((res) => {
      if (res.ok) queryClient?.invalidateQueries({ queryKey: eraKeys.widgets.activity() });
    })
    .catch(() => {});
}
