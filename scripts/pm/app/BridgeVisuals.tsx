import { EraCore } from "./EraCore";
import { coreSessionState } from "./coreState";
import { useId, useState } from "react";
import { ArrowUpRight, Check, CircleHelp, Minus } from "lucide-react";
import { sessionHref } from "./cockpitModel";
import { bridgeCharts } from "./bridgeModel";
import type { World } from "./types";

export function BridgeCore(props: Parameters<typeof coreSessionState>[0]) {
  const status = coreSessionState(props);
  return <EraCore status={status} uncertain={props.uncertain} />;
}

const qualityLabels = { clean: "Clean", failed: "Failed", unknown: "Unknown" };
const qualityIcons = { clean: Check, failed: Minus, unknown: CircleHelp };
const weekLabel = (week: string) => `${week.slice(8, 10)}/${week.slice(5, 7)}`;

export function BridgeCharts({
  world,
  unavailable,
}: {
  world: World;
  unavailable: boolean;
}) {
  const data = bridgeCharts(world);
  const [selected, setSelected] = useState<string | null>(null);
  const [quality, setQuality] = useState<"clean" | "failed" | "unknown" | null>(
    null,
  );
  const gradient = useId();
  const max = Math.max(
    1,
    ...data.shipped.buckets.map((b) => b.completed.length),
  );
  const selectedBucket = data.shipped.buckets.find((b) => b.week === selected);
  const qualityUnavailable =
    unavailable || !world.cockpit || world.cockpit.pending;
  let offset = 0;
  return (
    <div className="bridge-charts">
      <section className="bridge-chart" aria-label="Shipped outcomes">
        <div className="bridge-chart-heading">
          <div>
            <span className="bridge-kicker">Shipped outcomes</span>
            <strong>
              {unavailable ? "—" : data.shippedCount}
              <small>past 8 weeks</small>
            </strong>
          </div>
          <a
            className="bridge-chart-link"
            href="#/score?view=backlog"
            aria-label="Open outcome history"
          >
            <ArrowUpRight size={19} />
          </a>
        </div>
        {unavailable ? (
          <div className="bridge-chart-empty">History unavailable</div>
        ) : (
          <>
            <div
              className="bridge-bars-viewport"
              tabIndex={0}
              aria-label="Scroll weekly outcomes"
            >
              <div
                className="bridge-bars"
                role="group"
                aria-label="Weekly shipped outcomes"
              >
                <div className="bridge-chart-grid" aria-hidden="true">
                  <span>{max}</span>
                  <span>0</span>
                </div>
                {data.shipped.buckets.map((bucket) => (
                  <button
                    key={bucket.week}
                    className="bridge-bar"
                    aria-pressed={selected === bucket.week}
                    aria-label={`Week of ${bucket.week}: ${bucket.completed.length} shipped`}
                    onClick={() =>
                      setSelected(selected === bucket.week ? null : bucket.week)
                    }
                  >
                    <span className="bridge-bar-value">
                      {bucket.completed.length}
                    </span>
                    <span className="bridge-bar-track">
                      <span
                        style={{
                          height: `${(bucket.completed.length / max) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="bridge-bar-label">
                      {weekLabel(bucket.week)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bridge-chart-footnote">
              <span>Week of · DD/MM</span>
              {data.shipped.undated.completed.length > 0 && (
                <span>{data.shipped.undated.completed.length} undated</span>
              )}
            </div>
            {selectedBucket && (
              <div className="bridge-chart-detail" aria-live="polite">
                <strong>
                  Week of {selectedBucket.week} ·{" "}
                  {selectedBucket.completed.length} shipped
                </strong>
                {selectedBucket.completed.length ? (
                  <div className="bridge-outcome-ids">
                    {selectedBucket.completed.map((outcome) => (
                      <a
                        key={outcome.workId}
                        href={`#/explore?view=done&q=${encodeURIComponent(outcome.workId)}`}
                      >
                        {outcome.workId}
                        <ArrowUpRight size={12} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span>No recorded shipments</span>
                )}
              </div>
            )}
          </>
        )}
      </section>
      <section className="bridge-chart" aria-label="Session quality">
        <div className="bridge-chart-heading">
          <div>
            <span className="bridge-kicker">Session quality</span>
            <strong>
              {qualityUnavailable ? "—" : data.sessionCount}
              <small>recorded sessions</small>
            </strong>
          </div>
          <a
            className="bridge-chart-link"
            href="#/score"
            aria-label="Open session scores"
          >
            <ArrowUpRight size={19} />
          </a>
        </div>
        {qualityUnavailable ? (
          <div className="bridge-chart-empty">Session evidence unavailable</div>
        ) : (
          <div className="bridge-quality">
            <svg
              viewBox="0 0 180 180"
              className="bridge-donut"
              role="img"
              aria-label={
                data.sessionCount
                  ? data.quality
                      .map((g) => `${g.records.length} ${g.state}`)
                      .join(", ")
                  : "No sessions recorded"
              }
            >
              <defs>
                <linearGradient id={gradient}>
                  <stop stopColor="var(--accent)" />
                  <stop
                    offset="1"
                    stopColor="color-mix(in srgb, var(--accent) 65%, var(--ink))"
                  />
                </linearGradient>
              </defs>
              <circle className="quality-track" cx="90" cy="90" r="68" />
              {data.quality
                .filter((group) => group.records.length)
                .map((group) => {
                  const length =
                    (group.records.length / data.sessionCount) * 100;
                  const start = offset;
                  offset += length;
                  return (
                    <circle
                      key={group.state}
                      className={`quality-segment quality-${group.state}`}
                      cx="90"
                      cy="90"
                      r="68"
                      pathLength="100"
                      strokeDasharray={`${length} ${100 - length}`}
                      strokeDashoffset={-start}
                      style={
                        group.state === "clean"
                          ? { stroke: `url(#${gradient})` }
                          : undefined
                      }
                    />
                  );
                })}
              <text x="90" y="90" className="quality-total">
                {data.sessionCount}
              </text>
              <text x="90" y="111" className="quality-label">
                {data.sessionCount === 1 ? "session" : "sessions"}
              </text>
            </svg>
            <div className="bridge-quality-legend">
              {data.quality.map((group) => {
                const Icon = qualityIcons[group.state];
                return (
                  <button
                    key={group.state}
                    aria-pressed={quality === group.state}
                    data-quality={group.state}
                    onClick={() =>
                      setQuality(quality === group.state ? null : group.state)
                    }
                  >
                    <Icon size={14} />
                    <span>{qualityLabels[group.state]}</span>
                    <strong>{group.records.length}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!qualityUnavailable && quality && (
          <div className="bridge-chart-detail" aria-live="polite">
            <strong>{qualityLabels[quality]} sessions</strong>
            {data.quality
              .find((g) => g.state === quality)
              ?.records.map((record) => (
                <a
                  key={record.session.id}
                  href={sessionHref(record.session.id)}
                >
                  {record.session.itemId || record.session.id}
                  <ArrowUpRight size={12} />
                </a>
              ))}
            {!data.quality.find((g) => g.state === quality)?.records.length && (
              <span>No recorded sessions</span>
            )}
          </div>
        )}
        {!qualityUnavailable && !data.sessionCount && (
          <span className="bridge-chart-footnote">No sessions recorded</span>
        )}
      </section>
    </div>
  );
}
