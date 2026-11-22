import { memo, useId, useMemo, type RefObject } from "react";
import {
  BookOpen,
  Check,
  FileCode2,
  FileText,
  GitBranch,
  Shield,
} from "lucide-react";
import { Markdown } from "./components";
import type { LocalAction, LocalRunView } from "./LocalDelivery";
import { localRunActivity } from "./localRunActivityModel";
import type { LocalScene, LocalTimeline } from "./localRunScene";
import { LocalRunActivityPanel } from "./LocalRunActivityPanel";
import { LocalRunVerificationPanel } from "./LocalRunVerificationPanel";
import { LocalRunTools, type Tool } from "./LocalRunTools";
import { LocalChat } from "./LocalChat";
export type { Tool } from "./LocalRunTools";

export const LocalRunConsole = memo(
  function LocalRunConsole({
    run,
    snapshot,
    timeline,
    replay,
    patch,
    tool,
    setTool,
    panel,
    fileFilter,
    selectedAttentionId,
    setFileFilter,
    id: suppliedId,
    showTools = true,
  }: {
    run: LocalRunView;
    snapshot: LocalScene;
    timeline: LocalTimeline;
    replay: boolean;
    patch: string | null;
    tool: Tool;
    setTool: (value: Tool) => void;
    panel: RefObject<HTMLElement | null>;
    busy: boolean;
    act: (action: LocalAction) => void;
    fileFilter: string | null;
    selectedAttentionId?: string;
    setFileFilter: (value: string | null) => void;
    id?: string;
    showTools?: boolean;
  }) {
    const generatedId = useId(), id = suppliedId ?? generatedId;
    const viewRun = replay ? snapshot.run : run;
    const activity = useMemo(() => localRunActivity(viewRun), [viewRun]);
    const visibleEvents = useMemo(
      () =>
        (replay ? [...snapshot.events].reverse() : activity.events).filter(
          (event) => !fileFilter || event.paths.includes(fileFilter),
        ),
      [replay, snapshot.events, activity.events, fileFilter],
    );
    const summaryPrefix = `${run.run_id}:summary:`;
    const focusId = selectedAttentionId?.startsWith(summaryPrefix)
      ? selectedAttentionId.slice(summaryPrefix.length)
      : undefined;
    const visiblePatch = !replay || viewRun.head ? patch : null;
    const passed = viewRun.checks.filter(
      (check) => check.exit === 0 && !check.error,
    ).length;
    const files = useMemo(
      () =>
        visiblePatch
          ?.split(/\r?\n/u)
          .filter((line) => line.startsWith("diff --git "))
          .map((line) => line.replace(/^diff --git a\/.* b\//u, "")) || [],
      [visiblePatch],
    );
    return (
      <div className="run-game-console">
        {showTools && <LocalRunTools id={id} tool={tool} onSelect={setTool} passed={passed} files={files.length} />}
        <section
          ref={panel}
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tool}`}
          tabIndex={0}
          className="run-game-panel"
        >
          {tool === "activity" && !replay && <LocalChat run={run} compact limit={12} />}
          {tool === "activity" && (
            <LocalRunActivityPanel
              activity={activity}
              visibleEvents={visibleEvents}
              fileFilter={fileFilter}
              setFileFilter={setFileFilter}
              timeline={timeline}
              viewRun={viewRun}
              focusId={focusId}
            />
          )}

          {tool === "brief" && (
            <section aria-label="Plan" className="run-game-brief">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Work brief</span>
                  <h2>
                    <BookOpen size={18} />
                    Plan
                  </h2>
                </div>
                <span className="run-game-tag">{viewRun.work.id}</span>
              </div>
              {viewRun.work.brief ? (
                <Markdown raw={viewRun.work.brief} />
              ) : (
                <p className="quiet">Plan not recorded</p>
              )}
            </section>
          )}

          {tool === "verification" && (
            <LocalRunVerificationPanel
              viewRun={viewRun}
              snapshot={snapshot}
              passed={passed}
            />
          )}

          {tool === "changes" && (
            <section aria-label="Changes">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Build output</span>
                  <h2>
                    <FileCode2 size={18} />
                    Changes
                  </h2>
                </div>
                {viewRun.head && (
                  <code className="run-game-tag">
                    {viewRun.head.slice(0, 12)}
                  </code>
                )}
              </div>
              {files.length > 0 && (
                <ul className="run-game-files">
                  {files.map((file, index) => (
                    <li key={`${file}-${index}`}>
                      <FileText size={16} />
                      <code>{file}</code>
                      <Check size={14} />
                    </li>
                  ))}
                </ul>
              )}
              {visiblePatch === null ? (
                <div className="run-game-output">
                  <FileCode2 size={38} />
                  <strong>
                    {viewRun.head ? "Candidate recorded" : "Candidate pending"}
                  </strong>
                </div>
              ) : (
                <details className="run-game-disclosure" open>
                  <summary>Patch</summary>
                  <pre className="run-game-patch">
                    {visiblePatch || "No changes"}
                  </pre>
                </details>
              )}
              {viewRun.risk?.required && (
                <details className="run-game-disclosure">
                  <summary>Review required</summary>
                  <ul>
                    {viewRun.risk.flagged.map((file) => (
                      <li key={file.path}>
                        <code>{file.path}</code> · {file.domains.join(", ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          {tool === "worktree" && (
            <section aria-label="Worktree">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Workspace</span>
                  <h2>
                    <GitBranch size={18} />
                    Worktree
                  </h2>
                </div>
              </div>
              <div className="run-game-branch">
                <span className="run-game-branch-node">
                  <GitBranch size={26} />
                </span>
                <div>
                  <small>Branch</small>
                  <code>{viewRun.branch}</code>
                </div>
              </div>
              <dl className="run-game-worktree-facts">
                <div>
                  <dt>Path</dt>
                  <dd>
                    <code>{viewRun.workspace}</code>
                  </dd>
                </div>
                <div>
                  <dt>Candidate</dt>
                  <dd>
                    <code>{viewRun.head || "Not recorded"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Current head</dt>
                  <dd>
                    <code>{viewRun.current_head || "Not recorded"}</code>
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {tool === "limits" && (
            <section aria-label="Host limits">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Local boundary</span>
                  <h2>
                    <Shield size={18} />
                    Host limits
                  </h2>
                </div>
              </div>
              <div className="run-game-boundary">
                <span className="run-game-boundary-emblem">
                  <Shield size={44} strokeWidth={1} />
                </span>
                <div>
                  <strong>Host access</strong>
                  <p>
                    Credential scrub prevents accidents, not deliberate host
                    access.
                  </p>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    );
  },
  (before, after) =>
    before.run === after.run &&
    before.id === after.id &&
    before.showTools === after.showTools &&
    before.tool === after.tool &&
    before.replay === after.replay &&
    before.patch === after.patch &&
    before.busy === after.busy &&
    before.fileFilter === after.fileFilter &&
    before.selectedAttentionId === after.selectedAttentionId &&
    before.panel === after.panel &&
    before.act === after.act &&
    before.snapshot.latest?.id === after.snapshot.latest?.id &&
    before.snapshot.phase === after.snapshot.phase &&
    before.snapshot.run.head === after.snapshot.run.head &&
    before.snapshot.run.usage === after.snapshot.run.usage &&
    before.snapshot.run.handover === after.snapshot.run.handover,
);
