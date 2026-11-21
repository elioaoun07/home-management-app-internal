import { useState } from "react";
import { useRoute, useWorld } from "./state";
import { Back, Empty, PageTitle } from "./components";
import {
  evidenceFindings,
  ruleFact,
  sessionHref,
  setupDiff,
  sessionEvidenceGaps,
} from "./cockpitModel";
import { Fingerprint } from "./Setup";
import { SessionWorkspace } from "./SessionWorkspace";
import type { Flight } from "./cockpitTypes";
import { DetailLink } from "./DetailLink";
import { Evidence, RawEvidence } from "./CockpitUI";
import { Search } from "lucide-react";

const rules = Array.from({ length: 29 }, (_, i) => `HR-${i + 1}`);
export function VerdictStrip({
  record,
  compact = false,
}: {
  record: Flight;
  compact?: boolean;
}) {
  const failed = rules.filter(
    (rule) => ruleFact(record, rule)?.verdict === "fail",
  ).length;
  return (
    <details className="rule-verdicts" open={compact ? undefined : true}>
      <summary>
        Rules{" "}
        <span className="panel-verdict">
          {failed ? `${failed} failed` : "No recorded failures"}
        </span>
      </summary>
      <div className="verdict-strip" aria-label="Rule verdicts">
        {rules.map((rule) => {
          const fact = ruleFact(record, rule),
            verdict = fact?.verdict || "unknown";
          return (
            <a
              key={rule}
              href={`${sessionHref(record.session.id)}?rule=${rule}`}
              data-verdict={verdict}
              title={`${rule}: ${verdict}`}
              aria-label={`${rule}: ${verdict}`}
            >
              <small>{rule.replace("HR-", "")}</small>
              {verdict === "fail"
                ? "×"
                : verdict === "pass"
                  ? "✓"
                  : verdict === "improved"
                    ? "↗"
                    : "·"}
            </a>
          );
        })}
      </div>
    </details>
  );
}
function Summary({ record, onPin }: { record: Flight; onPin?: () => void }) {
  const s = record.session,
    cost = s.scorecard?.cost;
  return (
    <>
      <DetailLink
        className="session-identity"
        href={sessionHref(s.id)}
        onPin={onPin}
      >
        <b className="session-agent">
          {s.agent} · {s.tier || "Tier unknown"}
        </b>
        <span>
          {s.itemId || "No item"} ·{" "}
          {cost?.wallMs != null
            ? `${Math.round(cost.wallMs / 60000)} min`
            : "Duration unknown"}
        </span>
        <time dateTime={s.startedAt || undefined}>
          {s.startedAt
            ? s.startedAt
                .replace("T", " · ")
                .replace(/:\d\d(?:\.\d+)?Z$/, " UTC")
            : "Time unrecorded"}
        </time>
        <span className="session-outcome">
          {s.outcome && s.outcome !== "unrecorded"
            ? s.outcome
            : "Outcome unrecorded"}
        </span>
      </DetailLink>
      <VerdictStrip record={record} compact />
    </>
  );
}
export function FlightReport({ record }: { record: Flight }) {
  const route = useRoute(),
    s = record.session;
  const selected = route.query.get("rule");
  const { world } = useWorld();
  const delivery = world.cockpit?.deliveries.find((d) => d.itemId === s.itemId);
  const [station, setStation] = useState("prompt");
  const score = s.scorecard;
  const gaps = sessionEvidenceGaps(record);
  const stations: { label: string; evidence: unknown }[] = [
    { label: "prompt", evidence: s.intent || "Unrecorded" },
    {
      label: "skills",
      evidence: s.coverage === "transcript" ? s.skills : "Unrecorded",
    },
    {
      label: "reading",
      evidence: s.coverage === "transcript" ? s.reads : "Unrecorded",
    },
    {
      label: "edits",
      evidence:
        s.coverage === "transcript"
          ? s.timeline?.filter((t) => t.edit)
          : s.changeFacts || "Unrecorded",
    },
    { label: "hooks", evidence: record.events },
    { label: "checks", evidence: record.checks },
    { label: "verdicts", evidence: score?.rules.facts || record.verdicts },
    { label: "UAT", evidence: delivery?.uat || "Unrecorded" },
    { label: "ship", evidence: s.outcome || "Unrecorded" },
  ];
  return (
    <div className="flight-report">
      <Summary record={record} />
      {gaps.length > 0 && <section className="cockpit-panel" aria-label="Missing facts">
        <h2>Missing facts</h2>
        <ul>{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
      </section>}
      {selected && (
        <section className="cockpit-panel" id="rule-evidence">
          <h2>
            {selected} · {ruleFact(record, selected)?.verdict || "unknown"}
          </h2>
          {evidenceFindings(record, selected).map((f, i) => (
            <article key={i}>
              <b>{f.file ? `${f.file}:${f.line || 1}` : "Recorded finding"}</b>
              <pre>{f.excerpt || f.message || "No excerpt recorded"}</pre>
            </article>
          ))}
          {!evidenceFindings(record, selected).length && (
            <p>No finding recorded</p>
          )}
        </section>
      )}
      <div className="flight-path" aria-label="Flight timeline">
        {stations.map((t) => (
          <button
            className="secondary"
            key={t.label}
            aria-pressed={station === t.label}
            onClick={() => setStation(t.label)}
          >
            {t.label}
            {Array.isArray(t.evidence) && <small>{t.evidence.length}</small>}
          </button>
        ))}
      </div>
      <section className="cockpit-panel station-evidence">
        <h2>{station}</h2>
        <Evidence value={stations.find((t) => t.label === station)?.evidence} />
        <RawEvidence
          value={stations.find((t) => t.label === station)?.evidence}
        />
      </section>
      <div className="rule-grid">
        {(
          ["rules", "checks", "process", "scope", "autonomy", "cost"] as const
        ).map((panel) => (
          <details key={panel} className="cockpit-panel">
            <summary>
              {panel[0].toUpperCase() + panel.slice(1)}
              <span className="panel-verdict">
                {!score
                  ? "Unrecorded"
                  : panel === "rules" ||
                      panel === "checks" ||
                      panel === "process"
                    ? score[panel].verdict
                    : panel === "scope"
                      ? `${score.scope.files?.length ?? "—"} files`
                      : panel === "autonomy"
                        ? `${score.autonomy.questions ?? "—"} questions`
                        : `${score.cost.totalTokens?.toLocaleString() ?? "—"} tokens`}
              </span>
            </summary>
            <Evidence value={score?.[panel]} />
            <RawEvidence value={score?.[panel]} />
          </details>
        ))}
      </div>
    </div>
  );
}
export function Sessions() {
  const route = useRoute();
  const evidence =
    !!route.parts[1] ||
    route.query.get("view") === "history" ||
    ["pin", "rule", "cohort", "item", "agent"].some((key) =>
      route.query.has(key),
    );
  return evidence ? <AgentHistory /> : <SessionWorkspace />;
}
function AgentHistory() {
  const [search, setSearch] = useState("");
  const { world } = useWorld(),
    route = useRoute();
  const data = world.cockpit;
  const records = data?.records || [];
  if (data?.pending && route.query.get("view") !== "delivery")
    return <Empty title="Loading agent history" />;
  const id = route.parts[1],
    record = records.find((r) => r.session.id === id);
  const item = route.query.get("item"),
    agent = route.query.get("agent"),
    rule = route.query.get("rule");
  const pin = route.query.getAll("pin").slice(0, 2),
    pinned = pin
      .map((id) => records.find((r) => r.session.id === id))
      .filter((r): r is Flight => !!r);
  const cohort = route.query.get("cohort"),
    cohortRows =
      cohort === null
        ? null
        : data?.groups.find((g) => JSON.stringify(g.group) === cohort)?.raw ||
          [];
  const shown = records.filter(
    (r) =>
      (!item || r.session.itemId === item) &&
      (!agent || r.session.agent === agent) &&
      (!rule || ruleFact(r, rule)?.verdict === "fail") &&
      `${r.session.id} ${r.session.itemId || ""} ${r.session.agent} ${r.session.tier || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!cohortRows || cohortRows.some((s) => s.id === r.session.id)),
  );
  const toggle = (id: string) => {
    const q = new URLSearchParams(route.query);
    q.delete("pin");
    (pin.includes(id)
      ? pin.filter((p) => p !== id)
      : [...pin.slice(-1), id]
    ).forEach((p) => q.append("pin", p));
    location.hash = `${route.path}?${q}`;
  };
  return (
    <div className="cockpit">
      <Back fallback="/sessions" label="Sessions" />
      <PageTitle title="Agent evidence" />
      {data?.stale && <span role="status">Saved snapshot</span>}
      {
        <>
          {data?.warnings.map((w) => (
            <details key={w}>
              <summary>Source status</summary>
              {w}
            </details>
          ))}
          {id ? (
            record ? (
              <>
                <Back fallback="/sessions" />
                <div className="session-detail-grid">
                  <FlightReport key={id} record={record} />
                  {record.session.itemId && (
                    <section className="cockpit-panel">
                      <h2>{record.session.itemId}</h2>
                      {records
                        .filter(
                          (r) =>
                            r.session.itemId === record.session.itemId &&
                            r !== record,
                        )
                        .map((r) => (
                          <a
                            className="session-identity"
                            key={r.session.id}
                            href={sessionHref(r.session.id)}
                          >
                            {r.session.agent} ·{" "}
                            {r.session.startedAt || r.session.id}
                          </a>
                        ))}
                      <a
                        className="secondary"
                        href={
                          record.session.runId
                            ? `#/delivery/run/${encodeURIComponent(record.session.runId)}`
                            : "#/sessions?view=delivery"
                        }
                      >
                        Delivery evidence
                      </a>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <Empty title="Session unavailable" />
            )
          ) : (
            <>
              <p className="quiet">Saved prompts, edits and checks</p>
              <div className="cockpit-tools">
                <label className="cockpit-search">
                  <Search size={17} />
                  <input
                    aria-label="Search sessions"
                    placeholder="Find an item, agent or session"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Agent{" "}
                  <select
                    value={agent || ""}
                    onChange={(e) => {
                      const q = new URLSearchParams(route.query);
                      q.set("agent", e.target.value);
                      location.hash = `/sessions?${q}`;
                    }}
                  >
                    <option value="">All</option>
                    {[...new Set(records.map((r) => r.session.agent))].map(
                      (a) => (
                        <option key={a}>{a}</option>
                      ),
                    )}
                  </select>
                </label>
                {(item || rule || cohort || agent || search) && (
                  <a
                    className="secondary"
                    href="#/sessions?view=history"
                    onClick={() => setSearch("")}
                  >
                    Clear filters
                  </a>
                )}
                <span className="quiet">{shown.length} sessions</span>
              </div>
              {pinned.length === 2 && (
                <section className="cockpit-panel">
                  <h2>Comparison</h2>
                  <div className="compare-grid">
                    {pinned.map((r) => (
                      <div key={r.session.id}>
                        <Fingerprint hash={r.session.setup?.fingerprint} />
                        <Summary record={r} />
                      </div>
                    ))}
                  </div>
                  <p>{setupDiff(pinned[0], pinned[1]).state}</p>
                  <RawEvidence
                    value={{
                      left: pinned[0].session.setup,
                      right: pinned[1].session.setup,
                      changedSources: setupDiff(pinned[0], pinned[1]).files,
                    }}
                  />
                  <div className="compare-grid">
                    {pinned.map((r) => (
                      <FlightReport key={r.session.id} record={r} />
                    ))}
                  </div>
                </section>
              )}
              {!shown.length && (
                <Empty
                  title={
                    records.length
                      ? "No matching sessions"
                      : "No sessions recorded yet"
                  }
                >
                  <code>pnpm os:ingest</code>
                </Empty>
              )}
              <div className="session-list">
                {shown.map((r) => (
                  <article
                    className="cockpit-panel session-card"
                    key={r.session.id}
                  >
                    <Summary record={r} onPin={() => toggle(r.session.id)} />
                    <button
                      className="secondary"
                      aria-pressed={pin.includes(r.session.id)}
                      onClick={() => toggle(r.session.id)}
                    >
                      {pin.includes(r.session.id) ? "Unpin" : "Compare"}
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      }
    </div>
  );
}
