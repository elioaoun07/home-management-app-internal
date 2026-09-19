import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCopy,
  LockKeyhole,
  Undo2,
} from "lucide-react";
import { useCommand, useRoute, useWorld, type UndoSnapshot } from "./state";
import { transport } from "./transport";
import {
  backPath,
  briefPath,
  checklistPath,
  historyPath,
  readerPath,
  runFor,
  spacePath,
  workPath,
} from "./model";
import {
  Back,
  Empty,
  ErrorNotice,
  Markdown,
  OutcomeButton,
  RunLink,
  SpaceIcon,
  WorkLink,
} from "./components";
import type { Work } from "./types";
import { useV2Runs, V2RunLink } from "./DeliveryV2";
import { idSection } from "../shared/work-id.mjs";
import { executionKind } from "../shared/work-lifecycle.mjs";

export function UndoNotice({
  snapshots,
  onClose,
}: {
  snapshots: UndoSnapshot[];
  onClose: () => void;
}) {
  const command = useCommand();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (command.isPending || command.error) return;
    const timer = setTimeout(() => close.current(), 4000);
    return () => clearTimeout(timer);
  }, [command.isPending, command.error]);
  return (
    <div className="undo-notice" role="status">
      <span>Saved</span>
      <button
        disabled={command.isPending}
        onClick={() =>
          command.mutate(
            { op: "restore", body: { snapshots } },
            { onSuccess: onClose },
          )
        }
      >
        <Undo2 size={15} />
        Undo
      </button>
      {command.error && (
        <>
          <span>{command.error.message}</span>
          <button onClick={onClose}>Dismiss</button>
        </>
      )}
    </div>
  );
}
export function WorkView({ campaign, id }: { campaign: string; id: string }) {
  const { world, runs, connected } = useWorld();
  const route = useRoute();
  const v2 = useV2Runs();
  const work = world.work.find(
    (item) =>
      item.id.toUpperCase() === id.toUpperCase() && item.module === campaign,
  );
  const command = useCommand();
  const [undo, setUndo] = useState<UndoSnapshot[] | null>(null);
  const [copied, setCopied] = useState(false);
  const attempts = (v2.data?.runs || []).filter(
    (run) =>
      run.campaign === campaign &&
      String(run.alias || "").toUpperCase() === String(id).toUpperCase(),
  );
  const priorRuns = runs.filter(
    (run) =>
      run.item.campaign === campaign &&
      run.item.id?.toUpperCase() === id.toUpperCase(),
  );
  const receipts = world.history.filter(
    (entry) => entry.campaign === campaign && entry.workId === id.toUpperCase(),
  );
  const receipt = receipts[0];
  const book = world.spaces.find((space) => space.name === campaign)?.book;
  const brief = book && idSection(book.raw, id);
  if (!work)
    return (
      <div className="focus-page">
        <Back />
        {receipt ? (
          <>
            <header className="outcome-heading">
              <a
                className="outcome-space"
                href={`#${spacePath(campaign)}?tab=story`}
              >
                {campaign}
                <span>{id}</span>
              </a>
              <h1>
                {brief?.body.match(/\*\*Outcome:\*\*\s*([^\r\n]+)/)?.[1] ||
                  receipt.text}
              </h1>
              <div className="outcome-status">
                <span>
                  {receipt.status === "Shipped" ? "Done" : "Cancelled"}
                </span>
                <small>{receipt.date}</small>
                {brief?.body.match(/^\*\*UAT:\*\*\s*pending\s*$/m) && (
                  <small>UAT pending</small>
                )}
              </div>
            </header>
            <section className="focus-section">
              <h2>Completion record</h2>
              <Markdown raw={receipt.raw} file={receipt.file} />
              <a className="plain-link" href={`#${historyPath(receipt)}`}>
                View record
                <ArrowRight size={16} />
              </a>
            </section>
            {brief && book && (
              <details className="focus-disclosure">
                <summary>Scope and evidence</summary>
                <Markdown raw={brief.body} file={book.relPath} />
              </details>
            )}
          </>
        ) : brief && book && executionKind(brief.body) === "owner" ? (
          <Empty title="Owner check">
            <a
              className="secondary"
              href={`#${readerPath(book.relPath, brief.anchor)}`}
            >
              View checklist
              <ArrowRight size={16} />
            </a>
          </Empty>
        ) : !attempts.length && !priorRuns.length ? (
          <Empty title="This outcome has moved on">
            <a className="secondary" href={`#${spacePath(campaign)}?tab=story`}>
              See what changed
              <ArrowRight size={16} />
            </a>
          </Empty>
        ) : (
          <h1>{id}</h1>
        )}
        {!!(attempts.length + priorRuns.length) && (
          <section className="focus-section">
            <h2>Delivery history</h2>
            {attempts.map((attempt) => (
              <V2RunLink key={attempt.run_id} run={attempt} from={route.full} />
            ))}
            {priorRuns.map((run) => (
              <RunLink key={run.sessionId} run={run} from={route.full} />
            ))}
          </section>
        )}
        {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
      </div>
    );
  const choices = world.choices.filter((choice) =>
    work.decisionIds.includes(choice.id),
  );
  const followers = world.work.filter((item) =>
    work.dependentIds.includes(item.id),
  );
  const run = runFor(work, runs);
  const source =
    world.spaces.find((space) => space.name === campaign)?.book?.relPath ||
    work.file;
  const change = async (op: string, extra: Record<string, unknown> = {}) => {
    const result = await command.mutateAsync({
      op,
      body: {
        file: work.file,
        cbidx: work.cbidx,
        expectLine: work.rawLine,
        expectId: work.idChip,
        expectState: work.state,
        ...extra,
      },
    });
    if (result.undo) setUndo(result.undo);
  };
  const copyForCli = async () => {
    const text = [
      `${work.id} — ${work.title}`,
      `Source: ${work.file}`,
      `Outcome: ${work.outcome}`,
      work.contract && `Acceptance:\n${work.contract}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access denied; the owner can still copy from the page.
    }
  };
  const checklistHref = checklistPath(work, route.full);
  const briefHref = briefPath(work, world, route.full);
  return (
    <div className="focus-page">
      <Back fallback={spacePath(campaign)} label="Back to your place" />
      <header className="outcome-heading">
        <a className="outcome-space" href={`#${spacePath(campaign)}`}>
          <SpaceIcon name={campaign} size={19} />
          {campaign}
          <span>{work.label}</span>
        </a>
        <h1>{work.title}</h1>
        <div className="outcome-status">
          <span>
            {work.state === "done"
              ? "Done"
              : work.blocked
                ? "Waiting"
                : work.section === "Now"
                  ? "In focus"
                  : work.section === "Next"
                    ? "Up next"
                    : "Someday"}
          </span>
          {work.effort && <small>{work.effort} effort</small>}
        </div>
      </header>
      {work.outcome.replace(/[.!?]$/, "") !==
        work.title.replace(/[.!?]$/, "") && (
        <p className="outcome-intent">{work.outcome}</p>
      )}
      <div className="outcome-primary">
        <OutcomeButton
          work={work}
          run={run}
          from={route.full}
          disabled={!connected}
        />
        {work.state === "open" && (
          <button className="secondary" onClick={() => void copyForCli()}>
            <ClipboardCopy size={15} />
            {copied ? "Copied" : "Open in CLI"}
          </button>
        )}
        {work.blocked && (
          <span>
            <LockKeyhole size={14} />
            Prerequisites below
          </span>
        )}
      </div>
      {work.dependencies.length > 0 && (
        <section className="focus-section">
          <h2>Before this can move</h2>
          {work.dependencies.map((dependency) => {
            const target = world.work.find((item) => item.id === dependency.id);
            return (
              <div className="dependency" key={dependency.id}>
                <span
                  className={`dependency-mark ${["Completed", "Shipped"].includes(dependency.status) ? "done" : ""}`}
                >
                  {["Completed", "Shipped"].includes(dependency.status) ? (
                    <Check size={14} />
                  ) : (
                    <LockKeyhole size={13} />
                  )}
                </span>
                {target ? (
                  <a href={`#${workPath(target, route.full)}`}>
                    {target.title}
                    <small>
                      {dependency.status} · {target.module}
                    </small>
                  </a>
                ) : (
                  <span>
                    {dependency.id}
                    <small>{dependency.status}</small>
                  </span>
                )}
                {target && <ArrowRight size={16} />}
              </div>
            );
          })}
        </section>
      )}
      {choices.length > 0 && (
        <section className="focus-section">
          <h2>A choice to make</h2>
          {choices.map((choice) => (
            <a
              className="choice-link"
              href={`#/attention?id=${choice.id}&from=${encodeURIComponent(route.full)}`}
              key={choice.id}
            >
              <span>{choice.text}</span>
              <ArrowRight size={17} />
            </a>
          ))}
        </section>
      )}
      <details className="focus-disclosure">
        <summary>What done looks like</summary>
        <Markdown
          raw={work.contract || "No acceptance recorded."}
          file={source}
        />
      </details>
      {followers.length > 0 && (
        <details className="focus-disclosure">
          <summary>
            What this opens up <span>{followers.length}</span>
          </summary>
          {followers.map((item) => (
            <WorkLink key={item.key} work={item} from={route.full} compact />
          ))}
        </details>
      )}
      {!!(attempts.length + priorRuns.length) && (
        <section className="focus-section">
          <h2>Delivery history</h2>
          {attempts.map((attempt) => (
            <V2RunLink key={attempt.run_id} run={attempt} from={route.full} />
          ))}
          {priorRuns.map((prior) => (
            <RunLink key={prior.sessionId} run={prior} from={route.full} />
          ))}
        </section>
      )}
      {transport().capabilities.planWrites && (
        <details className="focus-disclosure">
          <summary>Organize</summary>
          <div className="organize-actions">
            <label>
              When
              <select
                value={work.section}
                disabled={
                  !connected || command.isPending || work.state !== "open"
                }
                onChange={(event) =>
                  void change("move-task", {
                    toHeading: event.target.value,
                  }).catch(() => {})
                }
              >
                {["Now", "Next", "Later"].map((lane) => (
                  <option key={lane}>{lane}</option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              disabled={!connected || command.isPending}
              onClick={() => void change("toggle").catch(() => {})}
            >
              {work.state === "done" ? "Reopen" : "Complete"}
              <Check size={15} />
            </button>
            {work.state === "done" && (
              <button
                className="secondary"
                disabled={!connected || command.isPending}
                onClick={() => void change("ship").catch(() => {})}
              >
                Ship
              </button>
            )}
            <button
              className="text-button"
              disabled={!connected || command.isPending}
              onClick={() => void change("discard").catch(() => {})}
            >
              Discard
            </button>
          </div>
        </details>
      )}
      <ErrorNotice error={command.error} />
      <details className="focus-disclosure">
        <summary>References</summary>
        <a className="plain-link" href={`#${checklistHref}`}>
          Checklist
          <ArrowRight size={15} />
        </a>
        {briefHref !== checklistHref && (
          <a className="plain-link" href={`#${briefHref}`}>
            Brief
            <ArrowRight size={15} />
          </a>
        )}
        <details>
          <summary>Discovery matches</summary>
          {work.topicEvidence.map((match) => (
            <p key={match.id}>{match.evidence}</p>
          ))}
        </details>
      </details>
      {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
    </div>
  );
}
export function selectionFromRoute(
  world: ReturnType<typeof useWorld>["world"],
  parts: string[],
  query: URLSearchParams,
): Work | undefined {
  if (parts[0] === "deliver")
    return world.work.find(
      (item) => item.module === parts[1] && item.id === parts[2],
    );
  const file = query.get("file"),
    cb = Number(query.get("cb"));
  return world.work.find((item) => item.file === file && item.cbidx === cb);
}
export const returnFromLaunch = (query: URLSearchParams) =>
  backPath(query.get("from"), "/explore");
