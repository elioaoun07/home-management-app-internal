import { useState } from "react";
import { client, pmKeys, useWorld, useRoute } from "./state";
import { useMutation } from "@tanstack/react-query";
import { v2Post } from "./api";
import { transport } from "./transport";
import { useV2Session } from "./DeliveryV2";
import { Empty, PageTitle, Markdown } from "./components";
import { chain, column, ruleFact, sessionHref, setupConflictCount } from "./cockpitModel";
import type { Cockpit, Entity, Setup as SetupData } from "./cockpitTypes";
import { SectionNav } from "./CockpitUI";
import { SetupSkillUse } from "./SetupSkillUse";
import { SetupDeliveryStorage } from "./SetupDeliveryStorage";
import { SetupDeliveryPush } from "./SetupDeliveryPush";
import {
  Search,
  Cpu,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Eye,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import { setupAttention } from "./setupAttention";
import {
  ruleCoverage,
  setupCoverage,
  ruleTitle,
  coverageLabel,
  conflictPresentation,
  groupSetupConflicts,
} from "./setupModel";
import "./setup.css";

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
export function SetupMap({ setup, skillUsage }: {
  setup: SetupData;
  skillUsage?: Cockpit["skillUsage"];
}) {
  const route = useRoute();
  const initial = route.query.get("entity") || route.query.get("rule") || "";
  const initialEntry = setup.entities.find((entry) => entry.id === initial);
  const [selected, setSelected] = useState(initial);
  const [agentFilter, setAgentFilter] = useState(
    route.query.get("agent") || "",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(
    initialEntry ? Math.max(1, column(initialEntry)) : 2,
  );
  const lit = chain(setup, selected);
  const members = agentFilter ? chain(setup, agentFilter) : null;
  const grouped = columns.map((_, i) =>
    setup.entities.filter((e) => column(e) === i && !e.retired),
  );
  const nodes = grouped.flatMap((list, c) =>
    list.map((e, row) => ({ e, x: c * 214 + 8, y: row * 48 + 44 })),
  );
  const positions = new Map(nodes.map((n) => [n.e.id, n]));
  const height = Math.max(...grouped.map((g) => g.length), 1) * 48 + 50;
  const current = setup.entities.find((e) => e.id === selected);
  const entries = grouped[category].filter(
    (e) =>
      (!members || members.has(e.id)) &&
      `${e.id} ${e.name || ""} ${e.title || ""} ${e.source || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
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
                aria-pressed={agentFilter === agent.id}
                onClick={() => {
                  setAgentFilter(agentFilter === agent.id ? "" : agent.id);
                  setSelected("");
                }}
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
          <button
            className="secondary"
            aria-pressed={!agentFilter}
            onClick={() => {
              setAgentFilter("");
              setSearch("");
            }}
          >
            All agents
          </button>
        </div>
        {category === 2 ? (
          <SetupSkillUse entries={entries} usage={skillUsage} selected={selected} onSelect={setSelected} />
        ) : <div className="setup-entries">
          {entries.map((e) => (
            <button
              className="setup-entry"
              key={e.id}
              onClick={() => setSelected(e.id)}
              aria-pressed={selected === e.id}
            >
              <strong>
                {e.kind === "rule" ? ruleTitle(e) : e.name || e.id}
              </strong>
              <small>{e.disabled ? "Disabled" : e.kind}</small>
              <code>{e.source || e.id}</code>
            </button>
          ))}
        </div>}
        {!entries.length && (
          <div className="queue-empty">No matching entries</div>
        )}
        {current && (
          <details className="setup-selection" open key={selected}>
            <summary>{current.name || current.id}</summary>
            <Markdown raw={current.title || current.name || current.id} />
            <code>{current.source}</code>
            {current.kind === "rule" && (
              <a
                className="secondary"
                href={`#/setup?tab=rulebook&rule=${encodeURIComponent(current.id)}`}
              >
                View coverage <ArrowRight size={16} />
              </a>
            )}
            {!!current.enforcedBy?.length && (
              <div className="setup-source-list">
                {current.enforcedBy.map((id) => (
                  <code key={id}>
                    {setup.entities.find((e) => e.id === id)?.source || id}
                  </code>
                ))}
              </div>
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
function RuleEvidence({
  rule,
  data,
}: {
  rule: Entity;
  data: Cockpit & { setup: SetupData };
}) {
  const guards = data.setup.entities.filter((entry) =>
    rule.enforcedBy?.includes(entry.id),
  );
  const missing = (rule.enforcedBy || []).filter(
    (id) => !guards.some((guard) => guard.id === id),
  );
  const observations = data.records.flatMap((record) => {
    const fact = ruleFact(record, rule.id);
    return fact ? [{ record, fact }] : [];
  });
  const failed = observations.find(({ fact }) => fact.verdict === "fail");
  const baselines = guards.filter((guard) => guard.baseline != null);
  return (
    <details className="setup-rule-evidence">
      <summary>Checks & evidence</summary>
      <Markdown raw={rule.title || rule.name || rule.id} />
      <code>{rule.source}</code>
      {rule.review && (
        <section className="setup-review-steps">
          <h3>Review steps</h3>
          <p>{rule.review.verify}</p>
          <code>{rule.review.source}</code>
        </section>
      )}
      <div className="setup-guard-list">
        {guards.map((guard) => (
          <div key={guard.id}>
            <strong>{guard.name || guard.id}</strong>
            <span>
              {guard.disabled
                ? "Disabled"
                : guard.kind === "detector"
                  ? guard.level === "advisory"
                    ? "Advisory check"
                    : "Automated check"
                  : guard.conditional
                    ? "Conditional stop guard"
                    : guard.blocking || guard.level === "blocked"
                      ? "Blocking guard"
                      : "Reminder"}
            </span>
            <code>{guard.source}</code>
            {!!guard.fixtures?.length && (
              <small>{guard.fixtures.length} regression fixtures</small>
            )}
            {guard.baseline != null && (
              <small>{guard.baseline} recorded baseline findings</small>
            )}
          </div>
        ))}
        {missing.map((id) => (
          <div key={id}>
            <strong>Guard missing</strong>
            <code>{id}</code>
          </div>
        ))}
      </div>
      <dl className="setup-evidence-facts">
        <div>
          <dt>Baseline evidence</dt>
          <dd>
            {baselines.length
              ? `${baselines.length} of ${guards.length} guards measured`
              : "Unmeasured"}
          </dd>
        </div>
        <div>
          <dt>Recorded sessions</dt>
          <dd>{observations.length}</dd>
        </div>
      </dl>
      {failed && (
        <a
          className="secondary"
          href={`${sessionHref(failed.record.session.id)}?rule=${rule.id}`}
        >
          Last failure <ArrowRight size={16} />
        </a>
      )}
      {observations.length > 0 && (
        <details>
          <summary>Session history</summary>
          {observations.map(({ record, fact }) => (
            <a
              className="session-identity"
              key={record.session.id}
              href={`${sessionHref(record.session.id)}?rule=${rule.id}`}
            >
              {record.session.startedAt || record.session.id} · {fact.verdict}
              {fact.added != null && fact.removed != null
                ? ` · +${fact.added} / −${fact.removed}`
                : ""}
            </a>
          ))}
        </details>
      )}
    </details>
  );
}

function ConflictGroups({
  entries,
  open = true,
}: {
  entries: Cockpit["conflicts"];
  open?: boolean;
}) {
  return (
    <div className="conflict-groups">
      {[...new Set(entries.map((entry) => entry.code))].map((code) => {
        const rows = entries.filter((entry) => entry.code === code);
        const presentation = conflictPresentation(rows[0]);
        return (
          <details
            className="cockpit-panel setup-conflict"
            key={code}
            open={open}
          >
            <summary>
              <strong>{presentation.title}</strong>
              <span className="count-badge">{rows.length}</span>
            </summary>
            <div className="setup-remedy">
              <span>{presentation.action}</span>
              {presentation.command && <code>{presentation.command}</code>}
            </div>
            {rows.map((entry, index) => (
              <article
                className="conflict-row"
                key={`${entry.source}-${index}`}
              >
                <p>{entry.message}</p>
                {entry.resolution &&
                  entry.resolution !== presentation.action && (
                    <p className="setup-remedy">{entry.resolution}</p>
                  )}
                <div className="setup-source-list">
                  <code>{entry.source}</code>
                  {entry.related && <code>{entry.related}</code>}
                </div>
                {entry.severity !== "info" && (
                  <a
                    className="secondary"
                    href={`#/library?capture=${encodeURIComponent(`${entry.code}: ${entry.message}\n${entry.source}\n${entry.related || ""}`)}`}
                  >
                    Capture issue <ArrowRight size={16} />
                  </a>
                )}
              </article>
            ))}
          </details>
        );
      })}
    </div>
  );
}

export function Setup() {
  const { world } = useWorld();
  const route = useRoute();
  const data = world.cockpit,
    setup = data?.setup;
  const requestedTab = route.query.get("tab") || "map";
  const tab =
    requestedTab === "map" && route.query.has("rule")
      ? "rulebook"
      : requestedTab;
  const [search, setSearch] = useState("");
  const session = useV2Session();
  const rescan = useMutation({ mutationFn: () => v2Post("cockpit/rescan", {}, 60000),
    onSuccess: () => client.invalidateQueries({ queryKey: pmKeys.data }) });
  if (!setup)
    return (
      <Empty title={data?.pending ? "Loading setup" : "Setup unavailable"}>
        {data?.warnings.join(" · ")}
      </Empty>
    );
  const coverage = setupCoverage(setup);
  const attention = setupAttention(data);
  const issues = groupSetupConflicts(data.conflicts);
  const selectedRule = route.query.get("rule");
  const filter = route.query.get("coverage") || "all";
  const ruleEntries = selectedRule
    ? setup.entities.filter(
        (entry) => entry.kind === "rule" && !entry.retired && !entry.disabled,
      )
    : coverage.rules;
  const rules = ruleEntries
    .filter((rule) => {
      const status = ruleCoverage(rule, setup);
      return (
        (!selectedRule || rule.id === selectedRule) &&
        (filter === "all" ||
          (filter === "automated" && ["checked", "blocked"].includes(status)) ||
          (filter === "manual" &&
            ["reminded", "documented"].includes(status)) ||
          (filter === "missing" && status === "missing")) &&
        (Boolean(selectedRule) ||
          `${rule.id} ${rule.title || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()))
      );
    })
    .sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
  const manualCount = coverage.manual;
  const actionable = setupConflictCount(data.conflicts);
  const agents = setup.entities.filter(
    (entry) => entry.kind === "agent" && !entry.retired,
  );
  return (
    <div className="cockpit setup-page">
      <PageTitle
        title="Setup"
        eyebrow="Agent instructions & safeguards"
        action={
          <div className="cockpit-tools">
            <button className="secondary" disabled={rescan.isPending || transport().capabilities.kind !== "local" || !session.data?.paired} onClick={() => rescan.mutate()}>{rescan.isPending ? "Scanning" : "Rescan"}</button>
          </div>
        }
      />
      <div className="setup-recorder" role="status">
        {data.recorder?.state === "recording" ? "Recording" : data.recorder?.state === "unavailable" ? <>
          Unavailable{data.recorder.since && <> since <time dateTime={data.recorder.since}>{Number.isFinite(Date.parse(data.recorder.since)) ? new Date(data.recorder.since).toLocaleString() : data.recorder.since}</time></>}
        </> : "Recorder unknown"}
      </div>
      {rescan.error && <p role="alert">{rescan.error.message}</p>}
      {data.stale && (
        <span role="status" className="setup-stale">
          Saved setup snapshot
        </span>
      )}
      <SectionNav
        label="Setup tabs"
        items={[
          { label: "Overview", href: "#/setup", active: tab === "map" },
          {
            label: "Rule coverage",
            href: "#/setup?tab=rulebook",
            active: tab === "rulebook",
          },
          {
            label: `Conflicts${actionable ? ` · ${actionable}` : ""}`,
            href: "#/setup?tab=conflicts",
            active: tab === "conflicts",
          },
          {
            label: "Configuration",
            href: "#/setup?tab=configuration",
            active: tab === "configuration",
          },
        ]}
      />
      {tab === "map" ? (
        <>
          <section
            className="setup-health"
            data-attention={attention.needsAttention || data.stale || undefined}
            aria-label="Setup health"
          >
            {attention.needsAttention || data.stale ? (
              <ShieldAlert size={28} />
            ) : (
              <CheckCircle2 size={28} />
            )}
            <div>
              <h2>
                {data.stale
                  ? "Saved setup status"
                  : attention.needsAttention
                    ? "Setup needs attention"
                    : "Setup checks clear"}
              </h2>
              <span>
                {issues.errors.length} errors · {issues.warnings.length}{" "}
                warnings · {attention.missingGuards.length} missing guards
              </span>
            </div>
            <a className="secondary" href="#/setup?tab=conflicts">
              Inspect <ArrowRight size={16} />
            </a>
          </section>
          {attention.missingGuards.length > 0 && (
            <section className="cockpit-panel" aria-label="Missing guards">
              <h2>Restore missing guards</h2>
              {attention.missingGuards.map((rule) => (
                <a
                  className="setup-action-row"
                  key={rule.id}
                  href={`#/setup?tab=rulebook&rule=${encodeURIComponent(rule.id)}`}
                >
                  <span>
                    <b>{rule.id}</b> {ruleTitle(rule)}
                  </span>
                  <ArrowRight size={16} />
                </a>
              ))}
            </section>
          )}
          {actionable > 0 && (
            <section className="cockpit-panel">
              <h2>Resolve conflicts</h2>
              {[
                ...new Set(
                  [...issues.errors, ...issues.warnings].map(
                    (entry) => entry.code,
                  ),
                ),
              ].map((code) => {
                const entries = [...issues.errors, ...issues.warnings].filter(
                  (entry) => entry.code === code,
                );
                return (
                  <a
                    className="setup-action-row"
                    href="#/setup?tab=conflicts"
                    key={code}
                  >
                    <span>{conflictPresentation(entries[0]).title}</span>
                    <span>
                      {entries.length} <ArrowRight size={16} />
                    </span>
                  </a>
                );
              })}
            </section>
          )}
          {transport().capabilities.kind === "local" && session.data?.paired && <div className="setup-overview-grid">
            <SetupDeliveryStorage />
            <SetupDeliveryPush />
          </div>}
          <div className="setup-overview-grid">
            <section
              className="cockpit-panel setup-coverage-summary"
              aria-label="Rule coverage"
            >
              <h2>
                Rule coverage <small>{coverage.rules.length} hard rules</small>
              </h2>
              <a
                className="setup-coverage-row"
                href="#/setup?tab=rulebook&coverage=automated"
              >
                <ShieldCheck size={20} />
                <span>Automated checks</span>
                <strong>{coverage.automated}</strong>
                <ArrowRight size={16} />
              </a>
              <a
                className="setup-coverage-row"
                href="#/setup?tab=rulebook&coverage=manual"
              >
                <Eye size={20} />
                <span>Human review</span>
                <strong>{manualCount}</strong>
                <ArrowRight size={16} />
              </a>
              <a
                className="setup-coverage-row"
                href="#/setup?tab=rulebook&coverage=missing"
              >
                <ShieldAlert size={20} />
                <span>Missing guards</span>
                <strong>{coverage.missing}</strong>
                <ArrowRight size={16} />
              </a>
              <details className="setup-help">
                <summary>
                  <CircleHelp size={15} /> How coverage works
                </summary>
                <p>Configured checks cover specific patterns.</p>
                <p>Human review covers behavior and design judgment.</p>
                <p>Missing guards require a configuration repair.</p>
              </details>
            </section>
            <section className="cockpit-panel">
              <h2>Agent configuration</h2>
              {agents.map((agent) => {
                const membership = chain(setup, agent.id);
                const skills = setup.entities.filter(
                  (entry) =>
                    entry.kind === "skill" &&
                    !entry.retired &&
                    membership.has(entry.id),
                ).length;
                return (
                  <a
                    className="setup-agent-row"
                    key={agent.id}
                    href={`#/setup?tab=configuration&agent=${encodeURIComponent(agent.id)}`}
                  >
                    <Cpu size={20} />
                    <span>
                      <strong>
                        {agent.name || agent.id.replace("agent:", "")}
                      </strong>
                      <small>{skills} skills</small>
                    </span>
                    <ArrowRight size={16} />
                  </a>
                );
              })}
            </section>
          </div>
          <details className="setup-snapshot">
            <summary>Scan details</summary>
            <dl className="setup-evidence-facts">
              <div>
                <dt>Scanned</dt>
                <dd>
                  <time dateTime={setup.generatedAt}>
                    {new Date(setup.generatedAt).toLocaleString()}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Fingerprint</dt>
                <dd>
                  <code>{setup.fingerprint}</code>
                </dd>
              </div>
            </dl>
            <a className="secondary" href="#/setup?tab=conflicts">
              {issues.info.length} setup notes <ArrowRight size={16} />
            </a>
          </details>
        </>
      ) : tab === "rulebook" ? (
        <>
          <div className="cockpit-tools">
            {!selectedRule && (
              <>
                <label className="cockpit-search">
                  <Search size={17} />
                  <input
                    aria-label="Search rules"
                    placeholder="Find a rule"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Rule coverage filter"
                  value={filter}
                  onChange={(event) => {
                    location.hash = `/setup?tab=rulebook&coverage=${event.target.value}`;
                  }}
                >
                  <option value="all">All rules</option>
                  <option value="automated">Automated checks</option>
                  <option value="manual">Human review</option>
                  <option value="missing">Missing guards</option>
                </select>
              </>
            )}
            {selectedRule && (
              <a
                className="secondary"
                href="#/setup?tab=rulebook"
                onClick={() => setSearch("")}
              >
                All rules
              </a>
            )}
          </div>
          <div className="rule-grid">
            {rules.map((rule) => {
              const status = ruleCoverage(rule, setup);
              return (
                <article
                  key={rule.id}
                  className="cockpit-panel setup-rule"
                  data-rule={rule.id}
                  data-coverage={status}
                >
                  <div className="setup-rule-heading">
                    <a href={`#/setup?tab=rulebook&rule=${rule.id}`}>
                      {rule.id}
                    </a>
                    <span
                      className="setup-coverage-label"
                      data-coverage={status}
                    >
                      {coverageLabel(status)}
                    </span>
                  </div>
                  <h2>{ruleTitle(rule)}</h2>
                  {status === "missing" && <p>Restore the declared guard.</p>}
                  {rule.review && (
                    <p className="setup-review-reason">{rule.review.reason}</p>
                  )}
                  <RuleEvidence rule={rule} data={{ ...data, setup }} />
                </article>
              );
            })}
          </div>
          {!rules.length && <Empty title="No matching rules" />}
        </>
      ) : tab === "configuration" ? (
        <SetupMap
          key={`${route.query.get("entity") || ""}-${route.query.get("agent") || ""}`}
          setup={setup}
          skillUsage={data.skillUsage}
        />
      ) : (
        <>
          <div className="setup-diagnostic-counts">
            <span>{issues.errors.length} errors</span>
            <span>{issues.warnings.length} warnings</span>
            <span>{issues.info.length} notes</span>
          </div>
          {!actionable && <Empty title="No setup conflicts" />}
          {issues.errors.length > 0 && (
            <section aria-label="Setup errors">
              <h2 className="setup-section-heading">Errors</h2>
              <ConflictGroups entries={issues.errors} />
            </section>
          )}
          {issues.warnings.length > 0 && (
            <section aria-label="Setup warnings">
              <h2 className="setup-section-heading">Warnings</h2>
              <ConflictGroups entries={issues.warnings} />
            </section>
          )}
          {issues.info.length > 0 && (
            <details className="setup-notes">
              <summary>Setup notes · {issues.info.length}</summary>
              <ConflictGroups entries={issues.info} open={false} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
