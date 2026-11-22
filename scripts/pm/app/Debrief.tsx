import type { LocalRunView } from "./LocalDelivery";
import {
  buildTimeline,
  sceneAt,
  type LocalTimeline,
  type LocalScene,
} from "./localRunScene";
import "./local-run-story.css";
import { localRunTokens } from "./stage/game";

const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Evidence chips require complete named evidence, never a zero from unknowns. */
export function debriefChips(
  run: LocalRunView,
  timeline: LocalTimeline,
  scene: LocalScene,
) {
  const knownFiles = scene.nodes.filter(
    (node) => node.edited && node.path !== null,
  ).length;
  const allPathsKnown = scene.nodes.every((node) => node.path !== null);
  const startKnown = timeline.events[0]?.summary === "Native session started";
  return [
    run.branch === `delivery/${run.work.id}`
      ? { title: "First attempt", fact: run.branch }
      : null,
    !timeline.truncated &&
    startKnown &&
    scene.elapsed !== null &&
    scene.elapsed < 600000
      ? { title: "Under 10 min", fact: duration(scene.elapsed) }
      : null,
    !timeline.truncated && allPathsKnown && knownFiles <= 3
      ? { title: "≤ 3 files", fact: String(knownFiles) }
      : null,
  ].filter((chip): chip is { title: string; fact: string } => chip !== null);
}

export function Debrief({
  run,
  timeline = buildTimeline(run),
  scene = sceneAt(timeline, timeline.end ?? 0),
}: {
  run: LocalRunView;
  timeline?: LocalTimeline;
  scene?: LocalScene;
}) {
  if (!scene.run.pushed && scene.phase !== "shipped") return null;
  const usage = run.usage;
  const tokens = localRunTokens(usage);
  const chips = debriefChips(run, timeline, scene);
  const knownFiles = scene.nodes.filter(
    (node) => node.edited && node.path !== null,
  ).length;
  const unknownFiles =
    scene.nodes.some((node) => node.edited && node.path === null) ||
    timeline.truncated;
  return (
    <section className="stage-debrief" aria-label="Pushed">
      <dl>
        {scene.elapsed !== null && (
          <div>
            <dt>Duration</dt>
            <dd>
              {duration(scene.elapsed)}
              {timeline.truncated ? "+" : ""}
            </dd>
          </div>
        )}
        <div>
          <dt>Files</dt>
          <dd>
            {knownFiles}
            {unknownFiles ? "+" : ""}
          </dd>
        </div>
        <div>
          <dt>Edits</dt>
          <dd>{scene.counts.edits}</dd>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>{scene.counts.checks}/4</dd>
        </div>
        {tokens !== null && (
          <div>
            <dt>Tokens</dt>
            <dd>{tokens.toLocaleString()}</dd>
          </div>
        )}
        {run.merge && (
          <div>
            <dt>Merge</dt>
            <dd>
              <code title={run.merge}>{run.merge.slice(0, 12)}</code>
            </dd>
          </div>
        )}
      </dl>
      <div className="stage-evidence-chips">
        {chips.map((chip) => (
          <span key={chip.title} tabIndex={0} title={chip.fact}>
            {chip.title}
            <small>{chip.fact}</small>
          </span>
        ))}
        <a href="#/score">Score ↗</a>
      </div>
    </section>
  );
}
