import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pmKeys, useWorld } from "./state";
import { transport } from "./transport";
import "./provider-status.css";

export type SdkStatus = "installed" | "missing" | "unknown" | "stale";
const FRESH_FOR_MS = 45_000;

/** SDK directory presence only. Never infer authentication or launch readiness. */
export function sdkStatus(
  available: boolean | null | undefined,
  observation: {
    observedAt: number;
    now: number;
    stale?: boolean;
    failed?: boolean;
  },
): SdkStatus {
  if (typeof available !== "boolean" || !observation.observedAt)
    return "unknown";
  if (
    observation.stale ||
    observation.failed ||
    observation.now - observation.observedAt > FRESH_FOR_MS
  )
    return "stale";
  return available ? "installed" : "missing";
}

const labels: Record<SdkStatus, string> = {
  installed: "SDK installed",
  missing: "SDK missing",
  unknown: "Unknown",
  stale: "Stale",
};

export function ProviderStatus() {
  const { connected, connection } = useWorld();
  const source = transport();
  const catalogue = useQuery({
    queryKey: pmKeys.v2executors,
    // Local: passive GET /api/delivery/v2/executors. Relay: its saved catalogue.
    queryFn: ({ signal }) => source.v2Executors(signal),
    enabled: connected,
    refetchInterval: 15_000,
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  // The relay catalogue has no SDK observation time. A fresh heartbeat does
  // not revalidate that saved fact, so retained mobile evidence stays stale.
  const stale =
    !connected || connection.stale || source.capabilities.kind === "relay";

  return (
    <div className="provider-status" role="group" aria-label="Agent SDKs">
      {(["claude", "codex"] as const).map((id) => {
        const name = id === "claude" ? "Claude" : "Codex";
        const entry = catalogue.data?.executors.find(
          (executor) => executor.id === id,
        );
        const state = sdkStatus(entry?.available, {
          observedAt: catalogue.dataUpdatedAt,
          now,
          stale,
          failed: catalogue.isError,
        });
        return (
          <span
            className="provider-status-item"
            data-status={state}
            key={id}
            aria-label={`${name}: ${labels[state]}`}
            title={
              state === "installed"
                ? "SDK package detected on laptop"
                : `${name}: ${labels[state]}`
            }
          >
            <span className="provider-status-dot" aria-hidden="true" />
            <span className="provider-status-name">{name}</span>
            <small>{labels[state]}</small>
          </span>
        );
      })}
    </div>
  );
}
