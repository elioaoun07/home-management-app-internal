// DLV-166. Run a Local candidate from its Test steps page. The supervisor
// starts `pnpm dev` in the run's worktree with the main checkout's env values.
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Play, Square } from "lucide-react";
import { isLoopbackOrigin } from "../../delivery-v2/local-auth-browser.mjs";
import { read, v2Post } from "./api";
import { ErrorNotice } from "./components";
import { client, pmKeys } from "./state";
import { transport } from "./transport";
import type { LocalRunView } from "./LocalDelivery";

/** The Local run behind a handover's `local:<run>` delivery ref, else null. */
export function localRunOf(deliveryRef: string | null | undefined): string | null {
  return /^local:(local-[0-9a-f-]{36})$/u.exec(deliveryRef ?? "")?.[1] ?? null;
}

// Same rule as LocalDelivery's offersLocalLane, without importing that module
// (it reaches UatWizard through the review surfaces).
const desktop = () => transport().capabilities.kind === "local" && isLoopbackOrigin(location.origin);

export function LocalPreview({ runId }: { runId: string }) {
  const enabled = desktop();
  const detail = useQuery({
    queryKey: pmKeys.localRun(runId),
    queryFn: ({ signal }) => read<LocalRunView>(`/api/delivery/v2/local/run?id=${encodeURIComponent(runId)}`, signal),
    enabled,
    refetchInterval: (query) => (query.state.data?.preview?.state === "starting" ? 1500 : 10_000),
  });
  const command = useMutation({
    mutationFn: (action: "preview" | "stop-preview") => v2Post("local", { action, run_id: runId }, 60_000),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.localRun(runId) }),
  });
  const run = detail.data;
  if (!enabled || !run) return null;
  const preview = run.preview ?? null;
  const live = preview?.state === "starting" || preview?.state === "ready";
  if (!live && run.phase !== "uat-ready") return null;
  return (
    <div className="uat-preview">
      <div className="uat-preview-row">
        {!live && (
          <button className="primary" disabled={command.isPending} onClick={() => command.mutate("preview")}>
            <Play size={16} aria-hidden />
            Run app
          </button>
        )}
        {preview?.state === "starting" && <span role="status">Starting…</span>}
        {preview?.state === "ready" && preview.url && (
          <a className="primary" href={preview.url} target="_blank" rel="noreferrer">
            {preview.url.replace(/^https?:\/\//u, "")}
            <ExternalLink size={13} aria-hidden />
          </a>
        )}
        {live && (
          <button className="secondary" disabled={command.isPending} onClick={() => command.mutate("stop-preview")}>
            <Square size={14} aria-hidden />
            Stop
          </button>
        )}
      </div>
      {preview?.state === "failed" && preview.tail && <pre className="uat-preview-log">{preview.tail}</pre>}
      <ErrorNotice error={command.error} />
    </div>
  );
}
