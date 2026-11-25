import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { RunOrb } from "./components";
import { LocalActions, type LocalAct, type LocalRunView } from "./LocalDelivery";
import { useGameLayer } from "./GameLayer";
import { LocalRunGame } from "./LocalRunGame";
import { LocalChat } from "./LocalChat";
import { displayTitle, newAttemptHref } from "./localRunModel";
import { OwnerWorkspace } from "./OwnerWorkspace";
import { LocalRunConsole, type Tool } from "./LocalRunConsole";
import "./local-run.css";
import { liveness, clock } from "./localRunLiveness";
import { localRunFailure, stripAnsi } from "./localRunFailure";
import { buildTimeline, sceneAt } from "./localRunScene";

export function LocalRunReview({
  run,
  busy,
  act,
  patch,
  poll,
  retry,
}: {
  run: LocalRunView;
  busy: boolean;
  act: LocalAct;
  patch: string | null;
  poll?: { dataUpdatedAt: number; isError: boolean };
  retry?: () => void;
}) {
  const game = useGameLayer();
  const [now, setNow] = useState(Date.now);
  const [tool, setTool] = useState<Tool>("activity");
  const [file, setFile] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const timeline = useMemo(() => buildTimeline(run), [run]);
  useEffect(() => {
    if (game.enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [game.enabled]);
  if (game.enabled)
    return (
      <LocalRunGame
        key={run.run_id}
        run={run}
        busy={busy}
        act={act}
        patch={patch}
        poll={poll}
        retry={retry}
      />
    );
  const running =
    ["preparing", "building", "checking", "accepting"].includes(run.phase) &&
    !run.interrupted &&
    !run.parked;
  const health = liveness(run, now, poll);
  const snapshot = sceneAt(timeline, now);
  const failure = localRunFailure(run);
  const title = displayTitle(run);
  const attempt = newAttemptHref(run);
  return (
    <>
      <header className="run-heading">
        <div>
          <span className="eyebrow">
            {run.work.campaign ? `${run.work.campaign} · ` : ""}
            {run.work.id} · Local
          </span>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="run-moment" aria-label="Session status">
        <RunOrb
          running={running}
          space={run.work.campaign || "Delivery"}
          size={90}
        />
        <div>
          <h2 aria-live="off">
            {health.caption}
            {snapshot.elapsed !== null && (
              <>
                {" "}
                ·{" "}
                <time>
                  {clock(snapshot.elapsed)}
                  {run.activity.length >= 200 ? "+" : ""}
                </time>
              </>
            )}
          </h2>
          <span className="stage-announcement" role="status">
            {health.state}
          </span>
          {run.settings && (
            <p>
              {[run.settings.executor, run.settings.model, run.settings.effort]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </section>
      {["preparing", "building", "checking", "accepting"].includes(run.phase) &&
        <LocalActions run={run} busy={busy} act={act} station="session" />}
      {(run.error || run.failure || run.interrupted) && (
        <section className="local-run-failure" aria-label="Session issue">
          <h2 role="alert">
            {run.interrupted
              ? "Session interrupted"
              : failure?.title}
          </h2>
          {!run.interrupted && run.failure && failure?.excerpt && (
            <pre className="black-box-excerpt">{failure.excerpt}</pre>
          )}
          {run.error && (
            <details>
              <summary>Error details</summary>
              <pre>{stripAnsi(run.error!)}</pre>
            </details>
          )}
          {attempt && <a className="primary" href={attempt}>New attempt</a>}
        </section>
      )}
      {attempt && !(run.error || run.failure || run.interrupted) && (
        <section className="local-run-failure" aria-label="Session closed">
          <a className="primary" href={attempt}>New attempt</a>
        </section>
      )}
      {run.parked && <LocalChat run={run} compact limit={1} composer={false} />}
      <OwnerWorkspace key={run.run_id} calm run={run} busy={busy} act={act} patch={patch} />
      <details className="calm-evidence" open={evidenceOpen} onToggle={event => setEvidenceOpen(event.currentTarget.open)}>
        <summary><FolderOpen size={17} />Session evidence<ChevronDown size={16} /></summary>
        {evidenceOpen && <LocalRunConsole run={run} snapshot={snapshot} timeline={timeline} replay={false} patch={patch}
          tool={tool} setTool={setTool} panel={panel} busy={busy} act={act} fileFilter={file} setFileFilter={setFile} />}
      </details>
    </>
  );
}
