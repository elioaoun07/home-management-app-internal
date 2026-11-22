import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  WrapText,
} from "lucide-react";
import { read } from "./api";
import { ErrorNotice } from "./components";
import type { LocalRunView } from "./LocalDelivery";
import { client, pmKeys } from "./state";

const PAGE_LINES = 150;

function diffRows(patch: string) {
  let before = 0,
    after = 0,
    inHunk = false;
  const source = patch.split(/\r?\n/u);
  if (source.at(-1) === "") source.pop();
  return source.flatMap((line) => {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line);
    if (header) {
      before = Number(header[1]);
      after = Number(header[2]);
      inHunk = true;
    } else if (line.startsWith("diff --git ")) {
      inHunk = false;
      return [];
    } else if (!inHunk && /^(index |--- |\+\+\+ )/u.test(line)) return [];
    const sign = inHunk && !header ? line[0] : "";
    return [
      {
        before: ["-", " "].includes(sign) ? before++ : null,
        after: ["+", " "].includes(sign) ? after++ : null,
        kind:
          sign === "+"
            ? "added"
            : sign === "-"
              ? "removed"
              : header
                ? "hunk"
                : "plain",
        line,
      },
    ];
  });
}

function PatchLines({ patch, wrap }: { patch: string; wrap: boolean }) {
  const [page, setPage] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => diffRows(patch), [patch]);
  const pages = Math.ceil(rows.length / PAGE_LINES);
  const index = Math.min(page, Math.max(0, pages - 1));
  function changePage(next: number) {
    setPage(next);
    scroller.current?.scrollIntoView({ block: "start" });
  }
  if (!rows.length) return <p className="quiet">No changes</p>;
  return (
    <>
      <div
        className="owner-diff-scroll"
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Code diff"
      >
        <div className="owner-diff-code" data-wrap={wrap}>
          {rows
            .slice(index * PAGE_LINES, (index + 1) * PAGE_LINES)
            .map((row, number) => (
              <div
                className="owner-diff-line"
                key={number}
                data-kind={row.kind}
              >
                <span aria-hidden="true">{row.before}</span>
                <span aria-hidden="true">{row.after}</span>
                <code>{row.line}</code>
              </div>
            ))}
        </div>
      </div>
      {pages > 1 && (
        <nav className="owner-patch-pages" aria-label="Diff pages">
          <button
            aria-label="Previous diff page"
            disabled={index === 0}
            onClick={() => changePage(index - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <small>
            {index + 1} / {pages}
          </small>
          <button
            aria-label="Next diff page"
            disabled={index + 1 >= pages}
            onClick={() => changePage(index + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </>
  );
}

function WrapButton({ wrap, toggle }: { wrap: boolean; toggle: () => void }) {
  return (
    <button
      type="button"
      className="owner-diff-wrap"
      aria-label="Wrap lines"
      title="Wrap lines"
      aria-pressed={wrap}
      onClick={toggle}
    >
      <WrapText size={17} />
    </button>
  );
}

type ComparisonFile = { path: string; status: string };
type Revisions = {
  runId: string;
  base: string;
  head: string;
  against: "base" | "repo";
};
type Actions = (available: boolean) => ReactNode;
type PatchObserver = (patch: string | null) => void;

function useViewedPatch(patch: string | null, observer?: PatchObserver) {
  useEffect(() => {
    observer?.(patch);
    return () => observer?.(null);
  }, [patch, observer]);
}

function comparisonUrl(
  { runId, head, against, base }: Revisions,
  path?: string,
) {
  const query = new URLSearchParams({ id: runId, head, against });
  if (path !== undefined) {
    query.set("path", path);
    query.set("source", base);
  }
  return "/api/delivery/v2/local/comparison?" + query;
}

function FilePatch({
  revisions,
  path,
  actions,
  reload,
  onPatchViewed,
  wrap,
}: {
  revisions: Revisions;
  path: string;
  actions: Actions;
  reload: () => Promise<unknown>;
  onPatchViewed?: PatchObserver;
  wrap: boolean;
}) {
  const { runId, base, head, against } = revisions;
  const query = useQuery(
    {
      queryKey: pmKeys.localComparison(runId, against, base, head, path),
      queryFn: ({ signal }) =>
        read<{ patch: string }>(comparisonUrl(revisions, path), signal),
      staleTime: Infinity,
      retry: false,
    },
    client,
  );
  useViewedPatch(
    query.error ? null : (query.data?.patch ?? null),
    onPatchViewed,
  );
  return (
    <>
      {query.error ? (
        <ErrorNotice
          error={query.error}
          retry={() => void reload().then(() => query.refetch())}
        />
      ) : query.data ? (
        <PatchLines patch={query.data.patch} wrap={wrap} />
      ) : (
        <p role="status">Reading file…</p>
      )}
      {actions(!!query.data && !query.error)}
    </>
  );
}

function RecordedDiff({
  revisions: initial,
  actions,
  onPatchViewed,
  flagged,
  wrap,
  toggleWrap,
}: {
  revisions: Revisions;
  actions: Actions;
  onPatchViewed?: PatchObserver;
  flagged?: LocalRunView["risk"];
  wrap: boolean;
  toggleWrap: () => void;
}) {
  const [selectedPath, selectPath] = useState("");
  const [against, setAgainst] = useState<Revisions["against"]>(initial.against);
  const revisions = { ...initial, against };
  const { runId, base, head } = revisions;
  const query = useQuery(
    {
      queryKey: pmKeys.localComparison(runId, against, base, head, null),
      queryFn: ({ signal }) =>
        read<{ base: string; files: ComparisonFile[] }>(
          comparisonUrl(revisions),
          signal,
        ),
      staleTime: against === "base" ? Infinity : 0,
      retry: false,
    },
    client,
  );
  const files = query.data?.files ?? [];
  const sourceFiles = files.filter((file) => file.path.startsWith("src/"));
  const implementation = sourceFiles.filter(
    (file) => !/\.(test|spec)\.[^/]+$/u.test(file.path),
  );
  const current =
    files.find((file) => file.path === selectedPath) ??
    implementation.find((file) =>
      flagged?.flagged.some((entry) => entry.path === file.path),
    ) ??
    implementation[0] ??
    sourceFiles[0] ??
    files[0];
  return (
    <section className="owner-diff" aria-label="Candidate comparison">
      <div className="owner-diff-binding">
        <FileCode2 size={17} aria-hidden="true" />
        <select
          aria-label="Compare against"
          value={against}
          onChange={(event) =>
            setAgainst(event.target.value === "repo" ? "repo" : "base")
          }
        >
          <option value="base">Run base</option>
          <option value="repo">Repo HEAD</option>
        </select>
        <code>
          {(query.data?.base ?? (against === "base" ? base : "")).slice(0, 8)}
        </code>
        <ArrowRight size={14} aria-hidden="true" />
        <span>
          Candidate <code>{head.slice(0, 8)}</code>
        </span>
        <WrapButton wrap={wrap} toggle={toggleWrap} />
      </div>
      {query.error ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p role="status">Reading changes…</p>
      ) : !current ? (
        <p className="quiet">No changed files</p>
      ) : (
        <>
          <label className="owner-diff-file">
            <span>
              {files.length === 1 ? "1 file" : files.length + " files"}
            </span>
            <select
              aria-label="Changed file"
              value={current.path}
              onChange={(event) => selectPath(event.target.value)}
            >
              {files.map((file) => (
                <option key={file.path} value={file.path}>
                  {against === "base" && file.status + " · "}
                  {file.path}
                </option>
              ))}
            </select>
          </label>
          <FilePatch
            key={against + query.data!.base + current.path}
            revisions={{ ...revisions, base: query.data!.base }}
            path={current.path}
            actions={actions}
            onPatchViewed={onPatchViewed}
            wrap={wrap}
            reload={() => query.refetch()}
          />
        </>
      )}
      {(!current || query.isError) && actions(false)}
    </section>
  );
}

export function OwnerDiff({
  run,
  patch,
  actions,
  onPatchViewed,
  against = "base",
}: {
  run: LocalRunView;
  patch: string | null;
  actions: Actions;
  onPatchViewed?: PatchObserver;
  against?: Revisions["against"];
}) {
  const [wrap, setWrap] = useState(true);
  const toggleWrap = () => setWrap((value) => !value);
  useViewedPatch(
    run.base && run.head ? null : patch,
    run.base && run.head ? undefined : onPatchViewed,
  );
  if (run.base && run.head)
    return (
      <RecordedDiff
        key={run.run_id + run.base + run.head}
        revisions={{
          runId: run.run_id,
          base: run.base,
          head: run.head,
          against,
        }}
        actions={actions}
        onPatchViewed={onPatchViewed}
        wrap={wrap}
        toggleWrap={toggleWrap}
        flagged={run.risk}
      />
    );
  if (patch !== null)
    return (
      <section className="owner-diff" aria-label="Candidate comparison">
        <div className="owner-diff-binding">
          <span>Candidate diff</span>
          <WrapButton wrap={wrap} toggle={toggleWrap} />
        </div>
        <PatchLines patch={patch} wrap={wrap} />
        {actions(true)}
      </section>
    );
  return (
    <>
      <p className="quiet">
        {run.head
          ? "Comparison unavailable for this recording"
          : "Awaiting candidate"}
      </p>
      {actions(false)}
    </>
  );
}
