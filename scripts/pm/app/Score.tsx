import { useRoute, useWorld } from "./state";
import { Empty, PageTitle } from "./components";
import { Dashboard } from "./Dashboard";
import { clean, sessionHref } from "./cockpitModel";
import { outcomeSeries, workOutcomes, weekOf } from "../shared/metrics.mjs";
import { GameLayer } from "./GameLayer";
import { Arena } from "./Arena";
import { ScoreNav, Evidence, RawEvidence } from "./CockpitUI";
export function Score() {
  const { world } = useWorld(),
    route = useRoute(),
    data = world.cockpit;
  if (route.query.get("view") === "backlog")
    return (
      <div className="cockpit">
        <PageTitle title="Score" />
        <ScoreNav view="backlog" />
        <Dashboard />
      </div>
    );
  if (route.query.get("view") === "arena") return <Arena />;
  const records = data?.records || [];
  if (data?.pending) return <Empty title="Loading scores" />;
  const weekly = outcomeSeries(
    workOutcomes({ history: world.history, work: world.work }),
  );
  const rules = [
    ...new Set(
      records.flatMap(
        (r) =>
          r.session.scorecard?.rules.facts
            .filter((f) => f.verdict === "fail")
            .map((f) => f.rule) || [],
      ),
    ),
  ];
  return (
    <div className="cockpit">
      <PageTitle title="Score" />
      {data?.stale && <span role="status">Saved snapshot</span>}
      <ScoreNav />
      <GameLayer />
      {!records.length && (
        <Empty title="No sessions recorded yet">
          <code>pnpm os:ingest</code>
        </Empty>
      )}
      <div className="rule-grid">
        <section className="cockpit-panel">
          <h2>Recent sessions</h2>
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Clean</th>
                <th>Process</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 8).map((r) => (
                <tr key={r.session.id}>
                  <td>
                    <a href={sessionHref(r.session.id)}>
                      {r.session.itemId || r.session.agent}
                      <small className="score-session-date">
                        {r.session.startedAt?.slice(0, 10) || "Date unrecorded"}
                      </small>
                    </a>
                  </td>
                  <td>
                    <a href={sessionHref(r.session.id)}>
                      {clean(r)
                        ? "pass"
                        : r.session.scorecard?.rules.verdict === "fail" ||
                            r.session.scorecard?.checks.verdict === "fail"
                          ? "fail"
                          : "unknown"}
                    </a>
                  </td>
                  <td>
                    <a href={sessionHref(r.session.id)}>
                      {r.session.scorecard?.process.verdict || "unknown"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > 8 && (
            <a className="plain-link" href="#/sessions">
              All sessions
            </a>
          )}
        </section>
        <section className="cockpit-panel">
          <h2>Rule failures</h2>
          {rules.map((rule) => (
            <a
              className="session-identity"
              href={`#/sessions?rule=${rule}`}
              key={rule}
            >
              {rule} ·{" "}
              {
                records.filter((r) =>
                  r.session.scorecard?.rules.facts.some(
                    (f) => f.rule === rule && f.verdict === "fail",
                  ),
                ).length
              }
            </a>
          ))}
          {!rules.length && <span>No recorded failures</span>}
        </section>
      </div>
      <section className="cockpit-panel">
        <h2>Model tiers</h2>
        {data?.groups.map((g) => (
          <article className="tier-row" key={JSON.stringify(g.group)}>
            <div className="tier-heading">
              <b>{g.group[0] || "Tier unknown"}</b>
              <a
                href={`#/sessions?cohort=${encodeURIComponent(JSON.stringify(g.group))}`}
              >
                {g.n} {g.n === 1 ? "session" : "sessions"}
              </a>
            </div>
            <details>
              <summary>Cohort</summary>
              <Evidence
                value={Object.fromEntries(
                  g.group.map((v, i) => [
                    [
                      "Tier",
                      "Effort",
                      "Kind",
                      "Risk",
                      "Item effort",
                      "Largest file",
                    ][i] || `Dimension ${i + 1}`,
                    v,
                  ]),
                )}
              />
            </details>
            {g.statisticsEligible && g.n > 10 ? (
              <a
                className="session-identity"
                href={`#/sessions?cohort=${encodeURIComponent(JSON.stringify(g.group))}`}
              >
                Clean{" "}
                {g.rates?.clean == null
                  ? "unknown"
                  : `${Math.round(g.rates.clean * 100)}%`}{" "}
                · Process{" "}
                {g.rates?.processComplete == null
                  ? "unknown"
                  : `${Math.round(g.rates.processComplete * 100)}%`}
              </a>
            ) : (
              <span className="quiet">
                Rates unavailable ·{" "}
                {g.n <= 10 ? "small sample" : "incomplete evidence"}
              </span>
            )}
            {g.n > 10 && (
              <a
                className="session-identity"
                href={`#/sessions?cohort=${encodeURIComponent(JSON.stringify(g.group))}`}
              >
                Tokens / shipped item{" "}
                {g.medianTokensPerShippedItem ?? "unknown"} · Escapes{" "}
                {g.escapes ?? "unknown"}
              </a>
            )}
            {!!g.trend?.some((p) => p.n > 10) && (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clean</th>
                    <th>Process</th>
                  </tr>
                </thead>
                <tbody>
                  {g.trend
                    .filter((p) => p.n > 10)
                    .map((p) => (
                      <tr key={p.sessionId}>
                        <td>
                          <a href={sessionHref(p.sessionId)}>
                            {p.at.slice(0, 10)} · n={p.n}
                          </a>
                        </td>
                        <td>
                          <a href={sessionHref(p.sessionId)}>
                            {p.rates?.clean == null
                              ? "unknown"
                              : `${Math.round(p.rates.clean * 100)}%`}
                          </a>
                        </td>
                        <td>
                          <a href={sessionHref(p.sessionId)}>
                            {p.rates?.processComplete == null
                              ? "unknown"
                              : `${Math.round(p.rates.processComplete * 100)}%`}
                          </a>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <details>
              <summary>Evidence</summary>
              {g.raw.map((r) => (
                <a
                  className="session-identity"
                  key={r.id}
                  href={sessionHref(r.id)}
                >
                  {r.id} · {r.rules} · {r.checks} · {r.process}
                </a>
              ))}
            </details>
          </article>
        ))}
      </section>
      <section className="cockpit-panel">
        <h2>Added · Shipped / week</h2>
        <details>
          <summary>
            Filing coverage ·{" "}
            {data?.filed.filter((f) => f.filedAt).length ?? "unknown"}/
            {data?.filed.length ?? "unknown"}
          </summary>
          {data?.filed.map((f) => (
            <a
              key={f.id}
              className="session-identity"
              href={`#/read?file=${encodeURIComponent(f.file.replace(/^ERA Notes\/10 - Project Management\//, ""))}&anchor=${f.id.toLowerCase()}`}
            >
              {f.id} · {f.filedAt || "Date unrecorded"}
            </a>
          ))}
        </details>
        {weekly.buckets.map((w) => {
          const filed =
            data?.filed.filter(
              (f) => f.filedAt && weekOf(f.filedAt) === w.week,
            ) || [];
          return (
            <details key={w.week}>
              <summary>
                {w.week} · {filed.length} dated additions · {w.completed.length}{" "}
                shipped
              </summary>
              {filed.map((f) => (
                <a
                  className="session-identity"
                  key={f.id}
                  href={`#/read?file=${encodeURIComponent(f.file.replace(/^ERA Notes\/10 - Project Management\//, ""))}&anchor=${f.id.toLowerCase()}`}
                >
                  {f.id} · {f.filedAt}
                </a>
              ))}
              {w.completed.map(
                (f: {
                  workId: string;
                  campaign: string;
                  record: { file: string; line: number } | null;
                }) => (
                  <a
                    className="session-identity"
                    key={`${f.campaign}:${f.workId}`}
                    href={`#/read?file=${encodeURIComponent(f.record?.file || "")}`}
                  >
                    {f.workId} · Shipped
                  </a>
                ),
              )}
            </details>
          );
        })}
      </section>
      <section className="cockpit-panel">
        <h2>Shipped items · Escapes</h2>
        {data?.deliveries.map((d) => (
          <details key={d.itemId}>
            <summary>
              {d.itemId} · {d.cost.totalTokens ?? "unknown"} tokens ·{" "}
              {d.escapes?.length ?? "unknown"} escapes
            </summary>
            <a href={`#/sessions?item=${d.itemId}`}>Sessions</a>
            <Evidence value={d} />
            <RawEvidence value={d} />
          </details>
        ))}
      </section>
    </div>
  );
}
