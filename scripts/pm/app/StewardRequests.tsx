import { useEffect, useState } from "react";
import { startReadinessIssues } from "./readinessModel";
import type { StewardRequest } from "./types";

/** Independently derived on each device, including while relay data is cached. */
export function coordinatorStatus(
  request: Pick<StewardRequest, "lastConfirmedAt" | "staleAfterMs">,
  now: number,
) {
  const at = Date.parse(request.lastConfirmedAt);
  return !Number.isFinite(at) ||
    !Number.isFinite(request.staleAfterMs) ||
    request.staleAfterMs <= 0 ||
    at > now ||
    now - at >= request.staleAfterMs
    ? "Status unconfirmed"
    : "Confirmed";
}

const label = (value: string) => value.replace(/[-_]/gu, " ");

export function StewardRequests({
  requests,
  now: suppliedNow,
}: {
  requests: StewardRequest[];
  now?: number;
}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!requests.length) return null;
  const now = suppliedNow ?? clock;
  return (
    <section className="steward-requests" aria-label="Delivery requests">
      {requests.map((request) => {
        const liveness = coordinatorStatus(request, now);
        const issues = request.blocker?.readiness
          ? startReadinessIssues(request.blocker.readiness)
          : [];
        return (
          <article className="steward-request" key={request.command_id}>
            <header>
              <strong>{request.workId}</strong>
              <span>Initiated by {request.initiatedBy}</span>
            </header>
            <dl>
              <div>
                <dt>Request / launch</dt>
                <dd>{request.command_id}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd>
                  <time dateTime={request.acceptedAt}>
                    {request.acceptedAt}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{request.startedAt || "Not started"}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{label(request.stage)}</dd>
              </div>
              <div>
                <dt>Job state</dt>
                <dd>{label(request.status)}</dd>
              </div>
              <div>
                <dt>Coordinator</dt>
                <dd role="status">{liveness}</dd>
              </div>
              <div>
                <dt>Last confirmed</dt>
                <dd>{request.lastConfirmedAt}</dd>
              </div>
              {request.jobUpdatedAt && (
                <div>
                  <dt>Job updated</dt>
                  <dd>{request.jobUpdatedAt}</dd>
                </div>
              )}
            </dl>
            {request.blocker && (
              <p>
                Blocker:{" "}
                {issues.length
                  ? issues.join(" · ")
                  : label(request.blocker.code)}
              </p>
            )}
            {request.run_id && (
              <a href={`#/delivery/run/${encodeURIComponent(request.run_id)}`}>
                Open delivery
              </a>
            )}
            <details>
              <summary>Evidence</summary>
              <p>Actor: {request.actor}</p>
              {request.evidence.map((entry, index) => (
                <p key={index}>
                  {entry.at} · {label(entry.code)}
                </p>
              ))}
              {request.runEvidence && (
                <p>
                  {request.runEvidence.at} · {request.runEvidence.kind} · #
                  {request.runEvidence.seq}
                </p>
              )}
              {request.result && (
                <p>
                  {request.result.at} · {request.result.result_id} · v
                  {request.result.version}
                </p>
              )}
              {request.blocker && (
                <pre>{JSON.stringify(request.blocker, null, 2)}</pre>
              )}
            </details>
          </article>
        );
      })}
    </section>
  );
}
