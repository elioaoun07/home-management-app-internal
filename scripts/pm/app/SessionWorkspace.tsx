import { useMemo } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ClipboardCheck,
  Layers3,
  MessageCircle,
  Search,
} from "lucide-react";
import { Back, ErrorNotice, PageTitle, SpaceIcon } from "./components";
import { StewardRequests, useClock } from "./StewardRequests";
import { PairV2, useV2Queue, useV2Runs, useV2Session } from "./DeliveryV2";
import { useUat } from "./UatWizard";
import { go, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import {
  sessionBoard,
  type SessionBoardCard,
  type SessionBoardCounts,
  type SessionBoardLane,
} from "./sessionBoardModel";
import "./session-workspace.css";

const ICONS = {
  running: Activity,
  needs: MessageCircle,
  uat: ClipboardCheck,
  waiting: Clock3,
  finished: CheckCheck,
  unknown: CircleHelp,
};
const PAGE_SIZE = 6;
const EMPTY_STATES: Record<SessionBoardLane, string> = {
  running: "No running sessions",
  needs: "No sessions need you",
  uat: "No items to test",
  waiting: "No waiting sessions",
  finished: "No finished sessions",
  unknown: "No unconfirmed sessions",
};
const countLabel = (counts: SessionBoardCounts) =>
  [
    counts.sessions &&
      `${counts.sessions} session${counts.sessions === 1 ? "" : "s"}`,
    counts.requests &&
      `${counts.requests} request${counts.requests === 1 ? "" : "s"}`,
    counts.acceptance &&
      `${counts.acceptance} item${counts.acceptance === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ") || "0 sessions";
const shortDate = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : null;

function SessionCard({ card, from }: { card: SessionBoardCard; from: string }) {
  const Icon = ICONS[card.lane];
  const href = (value: string) => {
    const [path, raw = ""] = value.split("?");
    const query = new URLSearchParams(raw);
    query.set("from", from);
    return `${path}?${query}`;
  };
  const date = shortDate(card.at);
  return (
    <article
      className="session-work-card"
      data-state={card.lane}
      data-outcome={card.outcome}
      data-kind={card.kind}
      data-last-known={card.lastKnown}
    >
      <header>
        <span>{card.campaign || "Agent session"}</span>
        <b>{card.workId || card.agent || "Session"}</b>
      </header>
      <a className="session-card-title" href={href(card.href)}>
        <h3>{card.title}</h3>
      </a>
      <div className="session-card-state">
        <Icon size={18} aria-hidden="true" />
        <span>{card.status}</span>
      </div>
      {card.lastKnown && (
        <span className="session-last-known">
          Last known · status unconfirmed
        </span>
      )}
      {card.stage && card.stage !== card.status && (
        <span className="session-last-known">{card.stage}</span>
      )}
      {card.testStatus && card.testHref && (
        <a className="session-evidence-link" href={href(card.testHref)}>
          <ClipboardCheck size={14} aria-hidden="true" />
          {card.testStatus}
        </a>
      )}
      {card.testProgress && card.testProgress.total > 0 && (
        <div className="session-test-progress">
          <progress
            value={card.testProgress.done}
            max={card.testProgress.total}
            aria-label="Passed test scenarios"
          />
          <span>
            {card.testProgress.done} / {card.testProgress.total} passed
          </span>
        </div>
      )}
      <div className="session-card-meta">
        <span>
          {card.unit === "acceptance" ? (
            <ClipboardCheck size={14} />
          ) : (
            <Bot size={14} />
          )}{" "}
          {card.unit === "acceptance"
            ? "Owner test"
            : card.agent ||
              (card.unit === "request" ? "Delivery request" : "Agent session")}
        </span>
        {date && <time dateTime={card.at || undefined}>{date}</time>}
      </div>
      <footer>
        <a className="session-card-action" href={href(card.href)}>
          {card.action}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        {card.evidenceHref && card.evidenceHref !== card.href && (
          <a className="session-evidence-link" href={href(card.evidenceHref)}>
            Evidence
          </a>
        )}
      </footer>
    </article>
  );
}

export function SessionWorkspace() {
  const { world, runs, runError, connected, connection, readError, runsReady } =
    useWorld();
  const route = useRoute();
  const now = useClock(15000);
  const session = useV2Session();
  const v2 = useV2Runs();
  const queue = useV2Queue();
  const uat = useUat(!!session.data?.paired);
  const statusKnown = !!(
    connected &&
    !connection.stale &&
    !readError &&
    runsReady &&
    session.data?.paired &&
    v2.isSuccess &&
    !v2.isError &&
    queue.isSuccess &&
    !queue.isError &&
    !session.isError
  );
  const board = useMemo(
    () =>
      sessionBoard({
        world,
        v1: runs,
        v2: v2.data?.runs,
        queue: queue.data,
        requests: v2.data?.requests,
        uat: uat.data,
        statusKnown,
        uatKnown: statusKnown && uat.isSuccess && !uat.isError,
        from: route.full,
        now,
      }),
    [
      world,
      runs,
      v2.data,
      queue.data,
      uat.data,
      uat.isSuccess,
      uat.isError,
      statusKnown,
      route.full,
      now,
    ],
  );
  const fallback =
    (
      [
        "needs",
        "running",
        "uat",
        "waiting",
        "unknown",
        "finished",
      ] as SessionBoardLane[]
    ).find((id) => board.lanes.find((lane) => lane.id === id)?.cards.length) ||
    "running";
  const legacy =
    route.query.has("tests") || route.query.has("testSearch")
      ? "uat"
      : route.query.get("history") === "1"
        ? "finished"
        : null;
  const selected =
    board.lanes.find(
      (lane) => lane.id === (route.query.get("state") || legacy || fallback),
    ) || board.lanes[0];
  const search = route.query.get("q") || route.query.get("testSearch") || "";
  const campaign = route.query.get("campaign") || "";
  const words = search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const matching = selected.cards.filter(
    (card) =>
      (!campaign || (card.campaign || "Agent sessions") === campaign) &&
      words.every((word) =>
        `${card.key} ${card.recordIds.join(" ")} ${card.requestId || ""} ${card.handoverId || ""} ${card.workId || ""} ${card.title} ${card.campaign || ""} ${card.agent || ""} ${card.status}`
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const requestedPage = Number(route.query.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, pages)
      : 1;
  const collections = [
    ...new Set(selected.cards.map((card) => card.campaign || "Agent sessions")),
  ]
    .map((name) => ({
      name,
      count: selected.cards.filter(
        (card) => (card.campaign || "Agent sessions") === name,
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const showCollections = selected.cards.length > 12 && !campaign && !search;
  const update = (values: Record<string, string>) => {
    const query = new URLSearchParams(location.hash.split("?")[1] || "");
    for (const key of [
      "view",
      "deliveryTab",
      "items",
      "tests",
      "testSearch",
      "history",
      "outcome",
    ])
      query.delete(key);
    query.set("state", selected.id);
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    go(`/sessions?${query}`);
  };
  const pairRequired =
    transport().capabilities.pairing && session.data?.paired === false;
  const StateIcon = ICONS[selected.id];
  const requestId = route.query.get("request");
  if (requestId) {
    const request = v2.data?.requests?.find(
      (entry) => entry.command_id === requestId,
    );
    return (
      <div className="session-workspace">
        <Back fallback="/sessions" />
        <PageTitle title={request?.workId || "Delivery request"} />
        {pairRequired ? <PairV2 /> : <ErrorNotice error={v2.error} />}{" "}
        {request ? (
          <StewardRequests requests={[request]} now={now} />
        ) : (
          <p className="quiet">Request unavailable</p>
        )}
      </div>
    );
  }
  return (
    <div className="session-workspace">
      <PageTitle
        title="Sessions"
        action={
          <a className="secondary" href="#/sprints">
            Open plan
            <ArrowRight size={15} />
          </a>
        }
      />
      <div className="session-workspace-status">
        <span className="session-source-status" data-current={statusKnown}>
          {statusKnown ? "Delivery connected" : "Delivery status unconfirmed"}
        </span>
        <a href="#/sessions?view=history">
          Agent evidence
          <ArrowRight size={13} />
        </a>
      </div>
      <ErrorNotice error={readError || runError} />
      {pairRequired ? (
        <PairV2 />
      ) : (
        <ErrorNotice
          error={session.error || v2.error || queue.error || uat.error}
          retry={() => {
            void session.refetch();
            void v2.refetch();
            void queue.refetch();
            void uat.refetch();
          }}
        />
      )}
      <div className="session-workspace-layout">
        <nav className="session-state-rail" aria-label="Session states">
          {board.lanes.map((lane) => {
            const Icon = ICONS[lane.id];
            return (
              <button
                key={lane.id}
                data-state={lane.id}
                aria-pressed={selected.id === lane.id}
                onClick={() =>
                  update({ state: lane.id, campaign: "", q: "", page: "" })
                }
              >
                <Icon size={20} aria-hidden="true" />
                <span>
                  <b>{lane.label}</b>
                  <small>
                    {!lane.known && !lane.cards.length
                      ? "Not confirmed"
                      : lane.id === "uat" && !lane.cards.length
                        ? "0 items"
                        : countLabel(lane.counts)}
                  </small>
                </span>
                <strong>
                  {!lane.known && !lane.cards.length ? "—" : lane.cards.length}
                </strong>
              </button>
            );
          })}
        </nav>
        <section
          className="session-state-content"
          aria-labelledby="session-state-title"
        >
          <header className="session-state-heading">
            <div>
              <span className="session-heading-icon">
                <StateIcon size={23} />
              </span>
              <div>
                <h2 id="session-state-title">{selected.label}</h2>
                <p>
                  {campaign ||
                    (!selected.known && !selected.cards.length
                      ? "Awaiting status"
                      : selected.id === "uat" && !selected.cards.length
                        ? "0 items"
                        : countLabel(selected.counts))}
                </p>
              </div>
            </div>
            {campaign && (
              <button
                className="secondary"
                onClick={() => update({ campaign: "", page: "" })}
              >
                <ArrowLeft size={14} />
                Campaigns
              </button>
            )}
          </header>
          <div className="session-workspace-tools">
            <label className="session-workspace-search">
              <Search size={18} />
              <input
                type="search"
                aria-label="Find a session or test"
                placeholder="Find an item, session or agent"
                value={search}
                onChange={(event) =>
                  update({ q: event.target.value, page: "" })
                }
              />
            </label>
            {!showCollections && collections.length > 1 && (
              <select
                aria-label="Session campaign"
                value={campaign}
                onChange={(event) =>
                  update({ campaign: event.target.value, page: "" })
                }
              >
                <option value="">All campaigns</option>
                {collections.map((group) => (
                  <option key={group.name}>{group.name}</option>
                ))}
              </select>
            )}
          </div>
          {showCollections ? (
            <div className="session-collections" aria-label="Campaign queues">
              {collections.map((group) => (
                <button
                  key={group.name}
                  className="session-collection"
                  onClick={() => update({ campaign: group.name, page: "" })}
                >
                  <SpaceIcon name={group.name} size={24} />
                  <h3>{group.name}</h3>
                  <strong>{group.count}</strong>
                  <span>
                    {selected.id === "uat" ? "To test" : selected.label}
                    <ArrowRight size={17} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {!matching.length ? (
                <div className="session-state-empty">
                  <Layers3 size={32} />
                  <h3>
                    {search
                      ? "No matches"
                      : !selected.known
                        ? "Status unconfirmed"
                        : EMPTY_STATES[selected.id]}
                  </h3>
                  {search && (
                    <button
                      className="secondary"
                      onClick={() => update({ q: "", page: "" })}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="session-work-grid">
                  {matching
                    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                    .map((card) => (
                      <SessionCard
                        key={card.key}
                        card={card}
                        from={route.full}
                      />
                    ))}
                </div>
              )}
              {matching.length > PAGE_SIZE && (
                <nav className="session-pagination" aria-label="Session pages">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, matching.length)} of{" "}
                    {matching.length}
                  </span>
                  <div>
                    <button
                      className="secondary"
                      aria-label="Previous page"
                      disabled={page === 1}
                      onClick={() => update({ page: String(page - 1) })}
                    >
                      <ChevronLeft size={17} />
                      Previous
                    </button>
                    <span>
                      {page} / {pages}
                    </span>
                    <button
                      className="secondary"
                      aria-label="Next page"
                      disabled={page === pages}
                      onClick={() => update({ page: String(page + 1) })}
                    >
                      Next
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
