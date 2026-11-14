import { useId, useState } from "react";
import { useWorld, useRoute } from "./state";
import { Empty, PageTitle, Markdown } from "./components";
import {
  chain,
  column,
  hardRules,
  ruleFact,
  sessionHref,
} from "./cockpitModel";
import type { Setup as SetupData } from "./cockpitTypes";
import { SectionNav, Metric } from "./CockpitUI";
import { Search, Cpu, ArrowRight } from "lucide-react";
import { setupAttention } from "./setupAttention";

export function Fingerprint({ hash }: { hash?: string | null }) {
  const bits = (hash || "").replace(/^sha256:/, "");
  return (
    <svg
      className="setup-glyph"
      viewBox="0 0 50 50"
      role="img"
      aria-label={`Setup ${hash || "unknown"}`}
    >
      {Array.from({ length: 15 }, (_, i) => {
        const on = parseInt(bits[i] || "0", 16) % 2;
        const x = i % 3,
          y = Math.floor(i / 3);
        return on ? (
          <g key={i}>
            <rect x={x * 10} y={y * 10} width="8" height="8" />
            <rect x={(4 - x) * 10} y={y * 10} width="8" height="8" />
          </g>
        ) : null;
      })}
    </svg>
  );
}
const columns = [
  "Agents",
  "Instructions",
  "Skills",
  "Hooks · permissions",
  "Checks · detectors",
  "Rules",
];
function RuleShield({ level }: { level?: string }) {
  const id = useId(),
    fill =
      (
        { documented: 0, reminded: 0.5, checked: 0.75, blocked: 1 } as Record<
          string,
          number
        >
      )[level || ""] || 0;
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 24 26"
      role="img"
      aria-label={`Shield ${level || "unknown"}`}
    >
      <defs>
        <clipPath id={id}>
          <path d="M12 1 23 5v8c0 6-7 10-11 12C8 23 1 19 1 13V5Z" />
        </clipPath>
      </defs>
      <rect
        x="0"
        y={26 * (1 - fill)}
        width="24"
        height={26 * fill}
        fill="currentColor"
        opacity=".55"
        clipPath={`url(#${id})`}
      />
      <path
        d="M12 1 23 5v8c0 6-7 10-11 12C8 23 1 19 1 13V5Z"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}
export function SetupMap({ setup }: { setup: SetupData }) {
  const route = useRoute();
  const [selected, setSelected] = useState(
    route.query.get("rule") || "agent:claude",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(route.query.get("rule") ? 5 : 2);
  const lit = chain(setup, selected);
  const grouped = columns.map((_, i) =>
    setup.entities.filter((e) => column(e) === i && !e.retired),
  );
  const nodes = grouped.flatMap((list, c) =>
    list.map((e, row) => ({ e, x: c * 214 + 8, y: row * 48 + 44 })),
  );
  const positions = new Map(nodes.map((n) => [n.e.id, n]));
  const height = Math.max(...grouped.map((g) => g.length), 1) * 48 + 50;
  const current = setup.entities.find((e) => e.id === selected);
  return (
    <>
      <div className="setup-agents" aria-label="Agents">
        {setup.entities
          .filter((e) => e.kind === "agent" && !e.retired)
          .map((agent) => {
            const members = chain(setup, agent.id);
            const count = setup.entities.filter(
              (e) => e.kind === "skill" && members.has(e.id),
            ).length;
            return (
              <button
                className="agent-card"
                key={agent.id}
                aria-pressed={selected === agent.id}
                onClick={() => setSelected(agent.id)}
              >
                <Cpu size={23} />
                <strong>{agent.name || agent.id.replace("agent:", "")}</strong>
                <small>{count} skills</small>
                <ArrowRight size={16} />
              </button>
            );
          })}
      </div>
      <section className="cockpit-panel setup-browser">
        <div className="cockpit-tools">
          <label className="cockpit-search">
            <Search size={17} />
            <input
              aria-label="Search setup"
              placeholder="Find a skill, rule or guard"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Setup category"
            value={category}
            onChange={(e) => setCategory(Number(e.target.value))}
          >
            {columns.slice(1).map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={() => setSelected("")}>
            Show all
          </button>
        </div>
        <div className="setup-entries">
          {grouped[category]
            .filter(
              (e) =>
                (!selected || lit.has(e.id)) &&
                `${e.id} ${e.name} ${e.title} ${e.source}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((e) => (
              <button
                className="setup-entry"
                key={e.id}
                onClick={() => setSelected(e.id)}
                aria-pressed={selected === e.id}
              >
                <strong>{e.name || e.title?.split(/[—·]/)[0] || e.id}</strong>
                <small>{e.level || e.kind}</small>
                <code>{e.source || e.id}</code>
              </button>
            ))}
        </div>
        {!grouped[category].some(
          (e) =>
            (!selected || lit.has(e.id)) &&
            `${e.id} ${e.name} ${e.title} ${e.source}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        ) && <div className="queue-empty">No matching entries</div>}
        {current && (
          <details className="setup-selection" open key={selected}>
            <summary>{current.name || current.id}</summary>
            <Markdown raw={current.title || current.name || current.id} />
            <code>{current.source}</code>
            {current.kind === "rule" && !current.enforcedBy?.length && (
              <p>No enforcement chain</p>
            )}
          </details>
        )}
      </section>
      <details className="setup-graph">
        <summary>Connection map</summary>
        <div
          className="setup-map"
          tabIndex={0}
          aria-label="Setup map, scroll to explore"
        >
          <svg viewBox={`0 0 1284 ${height}`} width="1284" height={height}>
            {columns.map((label, i) => (
              <text key={label} x={i * 214 + 8} y="23" fill="currentColor">
                {label}
              </text>
            ))}
            {setup.relations.map((r, i) => {
              const a = positions.get(r.from),
                b = positions.get(r.to);
              if (!a || !b) return null;
              return (
                <path
                  key={i}
                  className="map-edge"
                  data-lit={!selected || (lit.has(r.from) && lit.has(r.to))}
                  d={`M${a.x + 100},${a.y + 18} C${a.x + 210},${a.y + 18} ${b.x - 50},${b.y + 18} ${b.x + 10},${b.y + 18}`}
                >
                  <title>{r.type}</title>
                </path>
              );
            })}
            {nodes.map(({ e, x, y }) => (
              <foreignObject key={e.id} x={x} y={y} width="198" height="40">
                <button
                  className="map-node"
                  data-dim={!!selected && !lit.has(e.id)}
                  aria-pressed={selected === e.id}
                  onClick={() => setSelected(e.id)}
                  title={e.title || e.source || e.id}
                >
                  {e.name || e.title?.split(/[—·]/)[0].slice(0, 48) || e.id}
                </button>
              </foreignObject>
            ))}
          </svg>
        </div>
      </details>
    </>
  );
}
export function Setup() {
  const { world } = useWorld();
  const route = useRoute();
  const data = world.cockpit,
    setup = data?.setup;
  const tab = route.query.get("tab") || "map";
  const [weakest, setWeakest] = useState(true);
  const [search, setSearch] = useState("");
  if (!setup)
    return (
      <Empty title={data?.pending ? "Loading setup" : "Setup unavailable"}>
        {data?.warnings.join(" · ")}
      </Empty>
    );
  const levels = ["documented", "reminded", "checked", "blocked"];
  const rules = hardRules(setup).sort((a, b) =>
    weakest
      ? levels.indexOf(a.level || "") - levels.indexOf(b.level || "") ||
        Number(a.id.slice(3)) - Number(b.id.slice(3))
      : Number(a.id.slice(3)) - Number(b.id.slice(3)),
  );
  return (
    <div className="cockpit">
      <PageTitle
        title="Setup"
        action={<Fingerprint hash={setup.fingerprint} />}
      />
      {data.stale && <span role="status">Saved snapshot</span>}
      <SectionNav
        label="Setup tabs"
        items={[
          { label: "Overview", href: "#/setup?tab=map", active: tab === "map" },
          {
            label: "Rulebook",
            href: "#/setup?tab=rulebook",
            active: tab === "rulebook",
          },
          {
            label: `Conflicts · ${data.conflicts.length}`,
            href: "#/setup?tab=conflicts",
            active: tab === "conflicts",
          },
        ]}
      />
      {tab === "map" ? (
        <>
          <div className="cockpit-metrics">
            <Metric
              label="Rules"
              value={rules.length}
              href="#/setup?tab=rulebook"
            />
            <Metric
              label="Guarded rules"
              value={
                rules.filter((r) =>
                  ["checked", "blocked"].includes(r.level || ""),
                ).length
              }
              href="#/setup?tab=rulebook"
            />
            <Metric
              label="Conflicts"
              value={data.conflicts.length}
              href="#/setup?tab=conflicts"
            />
          </div>
          {setupAttention(data).missingGuards.length > 0 && (
            <section className="cockpit-panel" aria-label="Missing guards">
              <h2>Missing guards</h2>
              {setupAttention(data).missingGuards.map((rule) => (
                <a
                  className="session-identity"
                  key={rule.id}
                  href={`#/setup?tab=map&rule=${encodeURIComponent(rule.id)}`}
                >
                  {rule.id} ·{" "}
                  {rule.title?.split(/[—·]/)[0] || "Guard unavailable"}
                </a>
              ))}
            </section>
          )}
          <SetupMap key={route.query.get("rule") || "overview"} setup={setup} />
        </>
      ) : tab === "rulebook" ? (
        <>
          <div className="cockpit-tools">
            <label className="cockpit-search">
              <Search size={17} />
              <input
                aria-label="Search rules"
                placeholder="Find a rule"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              aria-pressed={weakest}
              onClick={() => setWeakest(!weakest)}
            >
              Weakest first
            </button>
          </div>
          <div className="rule-grid">
            {rules
              .filter((rule) =>
                `${rule.id} ${rule.title}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((rule) => {
                const guards = setup.entities.filter((e) =>
                  rule.enforcedBy?.includes(e.id),
                );
                const baselines = guards.filter((e) => e.baseline != null);
                const failed = data.records.find(
                  (r) => ruleFact(r, rule.id)?.verdict === "fail",
                );
                const changes = data.records
                  .slice()
                  .reverse()
                  .flatMap((record) => {
                    const fact = ruleFact(record, rule.id);
                    return fact && fact.added != null && fact.removed != null
                      ? [
                          {
                            id: record.session.id,
                            at: record.session.startedAt,
                            added: fact.added,
                            removed: fact.removed,
                          },
                        ]
                      : [];
                  });
                const max = Math.max(1, ...changes.map((c) => c.added));
                return (
                  <article key={rule.id} className="cockpit-panel">
                    <a href={`#/setup?tab=map&rule=${rule.id}`}>
                      <b>{rule.id}</b> ·{" "}
                      <span aria-label={`Shield ${rule.level}`}>
                        <RuleShield level={rule.level} /> {rule.level}
                      </span>
                    </a>
                    <h2 title={rule.title}>
                      {rule.title?.split(/[—·]/)[0].slice(0, 80)}
                    </h2>
                    <details>
                      <summary>
                        Baseline{" "}
                        {baselines.length
                          ? baselines.reduce((n, e) => n + (e.baseline || 0), 0)
                          : "unknown"}{" "}
                      </summary>
                      {guards.map((e) => (
                        <p key={e.id}>
                          <code>{e.source}</code> · {e.baseline ?? "unknown"}
                        </p>
                      ))}
                    </details>
                    {changes.length > 1 && (
                      <>
                        <small>Session Δ</small>
                        <svg
                          className="rule-trend"
                          viewBox="0 0 200 48"
                          role="img"
                          aria-label="New violations by recorded session"
                        >
                          <polyline
                            points={changes
                              .map(
                                (c, i) =>
                                  `${8 + (i * 184) / (changes.length - 1)},${40 - (c.added / max) * 30}`,
                              )
                              .join(" ")}
                            fill="none"
                            stroke="currentColor"
                          />
                          {changes.map((c, i) => (
                            <a
                              key={c.id}
                              href={`${sessionHref(c.id)}?rule=${rule.id}`}
                            >
                              <circle
                                cx={8 + (i * 184) / (changes.length - 1)}
                                cy={40 - (c.added / max) * 30}
                                r="5"
                                fill="currentColor"
                              >
                                <title>
                                  {c.at || c.id}: {c.added} added
                                </title>
                              </circle>
                            </a>
                          ))}
                        </svg>
                      </>
                    )}
                    {failed ? (
                      <a
                        href={`${sessionHref(failed.session.id)}?rule=${rule.id}`}
                      >
                        Last failure
                      </a>
                    ) : (
                      <span>Last failure unrecorded</span>
                    )}
                    <details>
                      <summary>Evidence</summary>
                      {changes.map((c) => (
                        <a
                          className="session-identity"
                          key={c.id}
                          href={`${sessionHref(c.id)}?rule=${rule.id}`}
                        >
                          {c.at || c.id} · +{c.added} / −{c.removed}
                        </a>
                      ))}
                      {guards.map((e) => (
                        <p key={e.id}>
                          <code>{e.source}</code> · {e.baseline ?? "unknown"}
                        </p>
                      ))}
                    </details>
                  </article>
                );
              })}
          </div>
        </>
      ) : (
        <div className="conflict-groups">
          {!data.conflicts.length && <Empty title="No setup conflicts" />}
          {[...new Set(data.conflicts.map((r) => r.code))].map((code) => (
            <details key={code} className="cockpit-panel">
              <summary>
                {code}
                <span className="count-badge">
                  {data.conflicts.filter((r) => r.code === code).length}
                </span>
              </summary>
              {data.conflicts
                .filter((r) => r.code === code)
                .map((r, i) => (
                  <article className="conflict-row" key={i}>
                    <b>{r.severity}</b>
                    <p>{r.message}</p>
                    <div className="compare-grid">
                      <code>{r.source}</code>
                      <code>{r.related || "No paired source"}</code>
                    </div>
                    <a
                      className="secondary"
                      href={`#/library?capture=${encodeURIComponent(`${r.code}: ${r.message}\n${r.source}\n${r.related || ""}`)}`}
                    >
                      Open as item
                    </a>
                  </article>
                ))}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
