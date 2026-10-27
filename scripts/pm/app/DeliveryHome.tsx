import { useMemo, type ReactNode } from "react";
import { ArrowRight, ChevronRight, Info } from "lucide-react";
import { ErrorNotice, RunLink, RunOrb, WorkLink } from "./components";
import { PairV2, useV2Queue, useV2Runs, useV2Session, Verdict } from "./DeliveryV2";
import {
  bareTitle,
  deliveredIds,
  groupDelivery,
  historyCounts,
  type HomeRow,
  type PastOutcome,
} from "./deliveryHomeModel";
import { bucketOf, deliveryAttemptDate, pastOutcomes } from "./model";
import { go, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import {
  blockerLine,
  coordinatorStatus,
  label,
  StewardRequests,
  useClock,
} from "./StewardRequests";
import { useUat } from "./UatWizard";
import { forRun, progress, reviewUat, runUatLabel, UAT_REVIEW_FILTERS, uatLabel, uatReviewGroup, type UatReviewFilter } from "./uatModel";
import type { StewardRequest, UatSummary, V2Queue } from "./types";
import { branchLabel, queueSlots, runningLabel, settingsLine } from "./v2model";

const FROM = "/delivery";
const HISTORY_LIMIT = 50;
const RECORDS_PAGE = 5;
const testHref = (id: string, from = FROM) => `#/delivery/test/${encodeURIComponent(id)}?from=${encodeURIComponent(from)}`;
const runHref = (id: string, from = FROM) =>
  `#/delivery/run/${encodeURIComponent(id)}?from=${encodeURIComponent(from)}`;
const sentence = (value: string) =>
  value ? value[0].toUpperCase() + value.slice(1) : value;
const kicker = (id?: string | null, space?: string | null) =>
  [id, space].filter(Boolean).join(" · ") || "Delivery";

type Group = "needs" | "progress" | "waiting" | "past";

function Line({
  href,
  space,
  active = false,
  kickerText,
  title,
  status,
  by,
  note,
  tone,
  at,
}: {
  href: string;
  space?: string | null;
  active?: boolean;
  kickerText: string;
  title: string;
  status: string;
  by?: string | null;
  note?: ReactNode;
  tone?: "needs";
  at?: string;
}) {
  return (
    <a className="run-link d-row" href={href} data-tone={tone}>
      <RunOrb running={active} space={space || undefined} size={48} />
      <span>
        <small>{kickerText}</small>
        <strong>{title}</strong>
        {at && <time dateTime={at}>{deliveryAttemptDate(at)}</time>}
        {note ? <span className="d-note">{note}</span> : null}
      </span>
      <span className="d-status">
        <b>{status}</b>
        {by && <small>{by}</small>}
      </span>
      <ArrowRight size={18} />
    </a>
  );
}

function RequestLine({
  request,
  title,
  now,
  group,
  from,
}: {
  request: StewardRequest;
  title: string;
  now: number;
  group: Group;
  from: string;
}) {
  const space = request.file.split("/")[0];
  const stale = !request.terminal && coordinatorStatus(request, now) !== "Confirmed";
  const note = [blockerLine(request), stale && "Status unconfirmed"]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="d-wrap">
      <Line
        href={
          request.run_id
            ? runHref(request.run_id, from)
            : `#/work/${encodeURIComponent(space)}/${encodeURIComponent(request.workId)}?from=${encodeURIComponent(from)}`
        }
        space={space}
        kickerText={kicker(request.workId, space)}
        title={title}
        status={request.status === "blocked" ? "Blocked" : sentence(label(request.status))}
        by={request.initiatedBy}
        note={note}
        tone={group === "needs" ? "needs" : undefined}
        at={request.acceptedAt}
      />
      <details className="d-detail">
        <summary>Request</summary>
        <StewardRequests requests={[request]} now={now} />
      </details>
    </div>
  );
}

function RowView({
  row,
  group,
  now,
  titleOf,
  uat,
  from,
}: {
  row: HomeRow;
  group: Group;
  now: number;
  titleOf: (request: StewardRequest) => string;
  uat?: UatSummary[];
  from: string;
}) {
  const { connected } = useWorld();
  const tone = group === "needs" ? "needs" : undefined;
  switch (row.kind) {
    case "v1":
      return <RunLink run={row.run} from={from} />;
    case "uat":
      return <UatLine item={row.item} tone={tone} from={from} />;
    case "request":
      return (
        <RequestLine
          request={row.request}
          title={titleOf(row.request)}
          now={now}
          group={group}
          from={from}
        />
      );
    case "decision": {
      const { item } = row;
      return (
        <Line
          href={runHref(item.run_id, from)}
          space={item.campaign}
          kickerText={kicker(item.alias, item.campaign)}
          title={bareTitle(item.title, item.alias)}
          status={item.label}
          by={row.request?.initiatedBy}
          note={[settingsLine(item), row.changed && "Source changed"]
            .filter(Boolean)
            .join(" · ")}
          tone={tone}
        />
      );
    }
    case "v2": {
      const { run } = row;
      const queued = group === "waiting" && row.coordination?.verdict;
      return (
        <Line
          href={runHref(run.run_id, from)}
          space={run.campaign}
          active={connected && run.active}
          kickerText={kicker(run.alias, run.campaign)}
          title={bareTitle(run.title, run.alias)}
          status={
            branchLabel(run.branch) ||
            (row.running ? runningLabel(row.running) : run.ownerAction)
          }
          by={row.request?.initiatedBy}
          note={
            group === "past" ? (
              <UatNote text={runUatLabel(run, forRun(uat, run.run_id))} />
            ) : queued ? (
              <Verdict
                verdict={row.coordination!.verdict}
                reasons={row.coordination!.reasons}
                limit={2}
              />
            ) : (
              settingsLine(run)
            )
          }
          tone={tone}
          at={run.created_at}
        />
      );
    }
  }
}

/** One test record: the owner's Test row, or a finished record in the list below it. */
function UatLine({ item, tone, from = FROM }: { item: UatSummary; tone?: "needs"; from?: string }) {
  const done = progress(item);
  const group = uatReviewGroup(item);
  return (
    <Line
      href={testHref(item.handover_id, from)}
      space={item.subject.campaign}
      kickerText={kicker(item.subject.work_id, item.subject.campaign)}
      title={item.subject.title || item.summary || item.subject.delivery_ref}
      status={group === "to-test" ? item.acceptance.state === "in-progress" ? "Continue" : "Start test" : group === "feedback" ? "View feedback" : group === "history" ? "View results" : "View steps"}
      at={item.created_at}
      note={<span className="uat-row-note">{item.stale ? "Build changed" : uatLabel(item)}{done.total ? ` · ${done.done}/${done.total} passed` : ""}</span>}
      tone={tone}
    />
  );
}
function UatNote({ text }: { text: string | null }) {
  return text ? <span className="uat-row-note">{text}</span> : null;
}

function Capacity({ queue }: { queue: V2Queue }) {
  const text = "Writers edit files; jobs run the executor. Each has a limit.";
  return (
    <span className="d-capacity">
      {queueSlots(queue).map((slot) => (
        <span key={slot.key} data-full={slot.full}>
          {slot.label} {slot.value}
        </span>
      ))}
      <span
        className="settings-info"
        tabIndex={0}
        role="note"
        aria-label={text}
        title={text}
      >
        <Info size={14} />
      </span>
    </span>
  );
}

function Section({
  title,
  count,
  tone,
  aside,
  children,
}: {
  title: string;
  count: number;
  tone?: "needs";
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="d-group" data-tone={tone} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <span className="d-count">{count}</span>
        {aside}
      </header>
      <div className="delivery-list">{children}</div>
    </section>
  );
}

/**
 * The Delivery tab: one row per delivery, grouped by what it asks of the owner
 * (Delivery actions, In progress, Waiting), after visible Review & sign off,
 * then what to start (In focus) and what ended (Earlier deliveries).
 * Launch receipts and queue slots are folded into those
 * rows instead of standing as separate cards.
 */
export function DeliveryHome() {
  const { runs, runError, world, connected, connection, readError, runsReady } = useWorld();
  const route = useRoute();
  const session = useV2Session();
  const v2 = useV2Runs();
  const queue = useV2Queue();
  const uat = useUat(!!session.data?.paired);
  const now = useClock(15000);
  const history = route.query.get("history") === "1";
  const selectedOutcome = route.query.get("outcome");
  const outcome: PastOutcome | "all" = pastOutcomes.some((o) => o.id === selectedOutcome) ? selectedOutcome as PastOutcome : "all";
  const requestedLimit = Number(route.query.get("shown"));
  const historyLimit = Number.isSafeInteger(requestedLimit) && requestedLimit >= HISTORY_LIMIT ? requestedLimit : HISTORY_LIMIT;
  const historyState = (values: Record<string, string>) => {
    const query = new URLSearchParams(route.query);
    for (const [key, value] of Object.entries(values)) query.set(key, value);
    go(`${route.path}?${query}`);
  };
  const handovers = uat.data ?? [];
  const testCounts = Object.fromEntries(UAT_REVIEW_FILTERS.map(({ id }) => [id, reviewUat(handovers, id).length]));
  const testSearch = route.query.get("testSearch") ?? "";
  const selectedTests = route.query.get("tests");
  const testFilter: UatReviewFilter = UAT_REVIEW_FILTERS.find(({ id }) => id === selectedTests)?.id
    ?? (testSearch ? "all" : testCounts["to-test"] ? "to-test" : testCounts.feedback ? "feedback" : testCounts["not-ready"] ? "not-ready" : "history");
  const requestedTests = Number(route.query.get("testShown"));
  const testsShown = Number.isSafeInteger(requestedTests) && requestedTests >= RECORDS_PAGE ? requestedTests : RECORDS_PAGE;
  const testRows = reviewUat(handovers, testFilter, testSearch);
  const requests = v2.data?.requests;
  const groups = useMemo(
    () =>
      groupDelivery({
        v2Runs: v2.data?.runs ?? [],
        queue: queue.data,
        requests: requests ?? [],
        v1Runs: runs,
        uat: uat.data,
      }),
    [v2.data?.runs, queue.data, requests, runs, uat.data],
  );
  const titleOf = (request: StewardRequest) => {
    const work = world.work.find(
      (item) =>
        item.file === request.file &&
        item.id.toUpperCase() === request.workId.toUpperCase(),
    );
    return work ? bareTitle(work.title, work.id) : request.workId;
  };
  const focus = useMemo(() => {
    const taken = deliveredIds(groups);
    return world.work
      .filter(
        (work) =>
          work.state === "open" &&
          bucketOf(work) === "now" &&
          !taken.has(work.id.toUpperCase()),
      )
      .slice(0, 3);
  }, [world.work, groups]);
  const deliveryNeeds = groups.needs.filter(row => row.kind !== "uat");
  const active = deliveryNeeds.length + groups.progress.length + groups.waiting.length;
  const counts = historyCounts(groups.past);
  const filtered = groups.past.filter((entry) => outcome === "all" || entry.outcome === outcome);
  const shown = filtered.slice(0, historyLimit);
  const pairRequired = transport().capabilities.pairing && session.data?.paired === false;
  const statusKnown = connected && !connection.stale && !readError && runsReady && session.data?.paired && v2.isSuccess && !v2.isError && queue.isSuccess && !queue.isError && !session.isError;
  const capacity = queue.data && (groups.progress.length || groups.waiting.length)
    ? groups.progress.length
      ? "progress"
      : "waiting"
    : null;
  const rows = (group: Exclude<Group, "past">, list: HomeRow[]) =>
    list.map((row) => (
      <RowView key={row.key} row={row} group={group} now={now} titleOf={titleOf} uat={uat.data} from={route.full} />
    ));
  return (
    <>
      <ErrorNotice error={runError} />
      {pairRequired ? <PairV2 /> : <>
        <ErrorNotice error={session.error || v2.error || queue.error} retry={() => { void session.refetch(); void v2.refetch(); void queue.refetch(); }} />
        {uat.isError && !uat.data && !v2.error && <ErrorNotice error={uat.error} />}
      </>}
      {!statusKnown && <p className="d-idle" role="status">{v2.data || queue.data ? "Last known Delivery status" : "Delivery status unavailable"}</p>}
      {uat.isError && !!uat.data && <p className="d-idle">Tests as of last refresh</p>}
      {transport().v2Uat && !pairRequired && (
        <section className="d-group uat-review" aria-labelledby="uat-review-title">
          <header><h2 id="uat-review-title">Review &amp; sign off</h2><span className="d-count">{handovers.length}</span></header>
          <div className="uat-review-tools">
            <div className="uat-review-search"><input aria-label="Find a delivery to review" type="search" placeholder="Work ID or title" value={testSearch} onChange={event => historyState({ testSearch: event.target.value, tests: "all", testShown: String(RECORDS_PAGE) })} /></div>
            <div className="segmented uat-review-filter" role="radiogroup" aria-label="Review status">
              {UAT_REVIEW_FILTERS.map(({ id, label }) => <button key={id} role="radio" aria-checked={testFilter === id} onClick={() => historyState({ tests: id, testShown: String(RECORDS_PAGE) })}>{label} <small>{testCounts[id]}</small></button>)}
            </div>
          </div>
          {testFilter === "not-ready" && !!testRows.length && <p className="uat-review-hint">Awaiting verified test instructions.</p>}
          {uat.isPending && !uat.data ? <p className="d-idle">Loading test steps</p> : !uat.isError && !testRows.length ? <p className="d-idle">{testSearch ? "No matching deliveries" : testFilter === "to-test" && testCounts["not-ready"] ? "Test steps are still being prepared." : "No deliveries here"}</p> : null}
          <div className="delivery-list">
            {testRows.slice(0, testsShown).map(item => <UatLine key={item.handover_id} item={item} from={route.full} />)}
          </div>
          {testsShown < testRows.length && <button className="secondary" onClick={() => historyState({ testShown: String(testsShown + 25) })}>Load more <small>{testRows.length - testsShown}</small></button>}
        </section>
      )}
      {!!deliveryNeeds.length && (
        <Section title="Delivery actions" tone="needs" count={deliveryNeeds.length}>
          {rows("needs", deliveryNeeds)}
        </Section>
      )}
      {!!groups.progress.length && (
        <Section
          title="In progress"
          count={groups.progress.length}
          aside={capacity === "progress" && queue.data ? <Capacity queue={queue.data} /> : null}
        >
          {rows("progress", groups.progress)}
        </Section>
      )}
      {!!groups.waiting.length && (
        <Section
          title="Waiting"
          count={groups.waiting.length}
          aside={capacity === "waiting" && queue.data ? <Capacity queue={queue.data} /> : null}
        >
          {rows("waiting", groups.waiting)}
        </Section>
      )}
      {!!queue.data?.pairs.length && (
        <details className="focus-disclosure d-overlaps">
          <summary>
            Overlaps <small>{queue.data.pairs.length}</small>
          </summary>
          <ul className="v2-list">
            {queue.data.pairs.map((pair) => (
              <li key={pair.a + ":" + pair.b}>
                <span>
                  {pair.a} · {pair.b}
                </span>
                <Verdict verdict={pair.verdict} reasons={pair.reasons} limit={2} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {!active && statusKnown && <p className="d-idle">Nothing running</p>}
      {!!focus.length && (
        <section className="next-section">
          <div className="section-title">
            <h2>In focus</h2>
            <a href="#/explore?lane=now">
              All
              <ArrowRight size={13} />
            </a>
          </div>
          {focus.map((work) => (
            <WorkLink work={work} key={work.key} from={FROM} />
          ))}
        </section>
      )}
      {!!groups.past.length && (
        <section className="focus-section">
          <button
            className="section-toggle"
            aria-expanded={history}
            onClick={() => historyState({ history: history ? "0" : "1" })}
          >
            Earlier deliveries
            <span>
              {groups.past.length}
              <ChevronRight size={17} />
            </span>
          </button>
          {history && (
            <div
              className="segmented history-filter"
              role="radiogroup"
              aria-label="Outcome"
            >
              {[
                { id: "all" as const, label: "All", count: groups.past.length },
                ...pastOutcomes
                  .map((o) => ({ ...o, count: counts[o.id] }))
                  .filter((o) => o.count),
              ].map((o) => (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={outcome === o.id}
                  onClick={() => historyState({ outcome: o.id, shown: String(HISTORY_LIMIT) })}
                >
                  {o.label} <small>{o.count}</small>
                </button>
              ))}
            </div>
          )}
          {history && (
            <div className="delivery-list">
              {shown.map(({ row }) => (
                <RowView
                  key={row.key}
                  row={row}
                  group="past"
                  now={now}
                  titleOf={titleOf}
                  uat={uat.data}
                  from={route.full}
                />
              ))}
              {shown.length < filtered.length && <button className="secondary" onClick={() => historyState({ shown: String(historyLimit + HISTORY_LIMIT) })}>Load more</button>}
            </div>
          )}
        </section>
      )}
    </>
  );
}
