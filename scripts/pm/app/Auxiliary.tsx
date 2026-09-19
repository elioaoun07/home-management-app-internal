import { useEffect, useState } from "react";
import { ArrowRight, Lightbulb, Send } from "lucide-react";
import { useRoute, useWorld, useCommand, type UndoSnapshot } from "./state";
import { transport } from "./transport";
import { liveRuns, sourceFile } from "./model";
import {
  Back,
  Empty,
  ErrorNotice,
  HistoryList,
  Markdown,
  PageTitle,
  RunLink,
  Sheet,
  WorkLink,
} from "./components";
import { UndoNotice } from "./Work";

export function Attention() {
  const { world, runs } = useWorld();
  const route = useRoute();
  const id = route.query.get("id");
  const decisions = world.choices.filter((choice) => !id || choice.id === id);
  const waiting = liveRuns(runs).filter((run) => run.awaiting);
  return (
    <div className="attention-page">
      <Back label="Back" />
      <PageTitle eyebrow="A human touch" title="Over to you." />
      {!id && waiting.length > 0 && (
        <section className="focus-section">
          <h2>Ready for your review</h2>
          {waiting.map((run) => (
            <RunLink key={run.sessionId} run={run} from={route.full} />
          ))}
        </section>
      )}
      <section className="choices-list">
        {decisions.map((choice) => (
          <article className="choice-card" key={choice.id}>
            <Lightbulb size={22} />
            <div>
              <span className="eyebrow">{choice.id}</span>
              <h2>{choice.text}</h2>
              <details open={!!id}>
                <summary>What it affects</summary>
                <Markdown raw={choice.constraint} file="_Decisions.md" />
                {world.work
                  .filter((work) => work.decisionIds.includes(choice.id))
                  .map((work) => (
                    <WorkLink
                      key={work.key}
                      work={work}
                      from={route.full}
                      compact
                    />
                  ))}
              </details>
            </div>
          </article>
        ))}
      </section>
      {!decisions.length && !waiting.length && (
        <Empty title="All clear for now" />
      )}
    </div>
  );
}
export function Activity() {
  const { world } = useWorld();
  const [limit, setLimit] = useState(24);
  return (
    <div className="activity-page">
      <Back />
      <PageTitle
        eyebrow="The things that moved"
        title="Your progress, recorded."
      />
      <HistoryList entries={world.history} limit={limit} />
      {world.history.length > limit && (
        <button
          className="secondary load-more"
          onClick={() => setLimit(limit + 24)}
        >
          More history
        </button>
      )}
    </div>
  );
}
export function Reader() {
  const { world } = useWorld();
  const route = useRoute();
  const path = route.query.get("file") || route.parts.slice(1).join("/");
  const file = sourceFile(world, path);
  const anchor = route.query.get("anchor");
  useEffect(() => {
    if (!anchor) return;
    const timer = setTimeout(() => {
      const target = document.getElementById(anchor);
      target?.scrollIntoView({ block: "start" });
      target?.classList.add("anchor-highlight");
      setTimeout(() => target?.classList.remove("anchor-highlight"), 2200);
    }, 0);
    return () => clearTimeout(timer);
  }, [path, anchor, file]);
  return (
    <div className="reader-page">
      <Back />
      <PageTitle
        eyebrow="Reference"
        title={path.split("/").at(-1)?.replace(/\.md$/, "") || "Reference"}
      />
      {file ? (
        <Markdown
          raw={file.raw.replace(/^---\n[\s\S]*?\n---\n/, "")}
          file={file.relPath}
        />
      ) : (
        <Empty title="This reference is outside the live collection">
          {transport().capabilities.referenceTools && (
            <a
              className="secondary"
              href={`/?ui=classic#/doc/${encodeURI(path)}`}
            >
              Open reference tools
              <ArrowRight size={15} />
            </a>
          )}
        </Empty>
      )}
    </div>
  );
}
export function Capture({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connected } = useWorld();
  const [text, setText] = useState("");
  const [undo, setUndo] = useState<UndoSnapshot[] | null>(null);
  const command = useCommand();
  const canCapture = transport().capabilities.capture;
  const save = async () => {
    if (!text.trim() || !connected || command.isPending || !canCapture) return;
    const result = await command.mutateAsync({
      op: "append",
      body: {
        file: "0 - Inbox.md",
        afterHeading: "New",
        line: `- [ ] ${text.trim().replace(/\r?\n/g, " ")}`,
      },
    });
    setText("");
    if (result.undo) setUndo(result.undo);
    onClose();
  };
  return (
    <>
      <Sheet title="Catch a thought" open={open} onClose={onClose}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save().catch(() => {});
          }}
        >
          <textarea
            className="capture-input"
            aria-label="Idea"
            placeholder="What’s on your mind?"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
          <ErrorNotice error={command.error} />
          <button
            className="primary"
            disabled={!text.trim() || !connected || command.isPending}
          >
            Save to Inbox
            <Send size={16} />
          </button>
        </form>
      </Sheet>
      {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
    </>
  );
}
