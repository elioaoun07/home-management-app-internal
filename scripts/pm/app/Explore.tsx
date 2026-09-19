import { useDeferredValue, useState } from "react";
import { Search, ArrowRight, X } from "lucide-react";
import { useRoute, useWorld, go } from "./state";
import { bucketOf, buckets, discover, doneReceipts, spacePath } from "./model";
import { Board } from "./Board";
import {
  Back,
  Distribution,
  Empty,
  HistoryList,
  PageTitle,
  SpaceIcon,
  WorkLink,
} from "./components";
import type { Bucket, Work } from "./types";

export const countsOf = (work: Work[]): Record<Bucket, number> => ({
  now: work.filter((item) => bucketOf(item) === "now").length,
  next: work.filter((item) => bucketOf(item) === "next").length,
  waiting: work.filter((item) => bucketOf(item) === "waiting").length,
  later: work.filter((item) => bucketOf(item) === "later").length,
});
export function Explore() {
  const { world } = useWorld();
  const route = useRoute();
  const mode = ["board", "list"].includes(route.query.get("view") || "")
    ? (route.query.get("view") as "board" | "list")
    : "search";
  const query = route.query.get("q") || "";
  const lane = route.query.get("lane");
  const term = useDeferredValue(query);
  const [limit, setLimit] = useState(18);
  const completed = doneReceipts(world).filter((entry) =>
    `${entry.workId} ${entry.text} ${entry.campaign}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );
  const open = world.work.filter((item) => item.state === "open");
  const checked = discover(
    world.work.filter((item) => item.state === "done"),
    term,
  );
  const found = discover(open, term).filter(
    (item) => !lane || bucketOf(item) === lane,
  );
  const counts = countsOf(open);
  const change = (patch: Record<string, string>) => {
    const params = new URLSearchParams(route.query);
    Object.entries(patch).forEach(([key, value]) =>
      value ? params.set(key, value) : params.delete(key),
    );
    setLimit(18);
    go(`/explore${params.size ? `?${params}` : ""}`);
  };
  const isDone = route.query.get("view") === "done";
  const navigation = (
    <nav className="space-navigation" aria-label="Work status">
      <a
        className="secondary"
        aria-current={!isDone ? "page" : undefined}
        href="#/explore"
      >
        To do
      </a>
      <a
        className="secondary"
        aria-current={isDone ? "page" : undefined}
        href="#/explore?view=done"
      >
        Done
      </a>
    </nav>
  );
  if (isDone)
    return (
      <div className="explore-page">
        <PageTitle title="Done" />
        {navigation}
        <div className="discovery-search">
          <Search size={23} />
          <input
            aria-label="Find completed work"
            placeholder="Find completed work"
            value={query}
            onChange={(event) => change({ q: event.target.value })}
          />
        </div>
        {checked.map((work) => (
          <WorkLink work={work} key={work.key} from={route.full} />
        ))}
        {completed.length ? (
          <HistoryList entries={completed} limit={limit} />
        ) : !checked.length ? (
          <Empty title="No completed work found" />
        ) : null}
        {completed.length > limit && (
          <button
            className="secondary load-more"
            onClick={() => setLimit(limit + 18)}
          >
            Show more
          </button>
        )}
      </div>
    );
  if (mode !== "search")
    return (
      <div className="explore-page">
        <PageTitle
          title="Organize your work."
          action={
            <a className="secondary" href="#/explore">
              <Search size={15} />
              Search instead
            </a>
          }
        />
        {navigation}
        <Board work={world.work} basePath="/explore" />
      </div>
    );
  return (
    <div className="explore-page">
      <PageTitle
        title="Find your next move."
        action={
          <a className="secondary" href="#/explore?view=board">
            Board
          </a>
        }
      />
      {navigation}
      <div className="discovery-search">
        <Search size={23} />
        <input
          aria-label="Find work"
          placeholder="AI, Catalogue, Kitchen…"
          value={query}
          onChange={(event) => change({ q: event.target.value })}
        />
        {query && (
          <button
            className="icon-button"
            aria-label="Clear search"
            onClick={() => change({ q: "" })}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="discovery-prompts">
        {["AI", "Mobile", "Offline", "Household", "Catalogue"].map((label) => (
          <button
            key={label}
            aria-pressed={query === label}
            onClick={() => change({ q: query === label ? "" : label })}
          >
            {label}
          </button>
        ))}
      </div>
      {!query && !lane ? (
        <>
          <section className="work-collections" aria-label="Explore work">
            {buckets.map((bucket, index) => (
              <button
                key={bucket.id}
                className={`work-collection collection-${bucket.id}`}
                onClick={() => change({ lane: bucket.id })}
              >
                <span className="collection-symbol">
                  {["◉", "↗", "◷", "✳"][index]}
                </span>
                <div>
                  <strong>{bucket.label}</strong>
                  <span>{counts[bucket.id]} outcomes</span>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
          </section>
          <section className="all-spaces">
            <div className="section-title">
              <h2>Explore your spaces</h2>
              <span>{world.spaces.length}</span>
            </div>
            {world.spaces.map((space) => (
              <a href={`#${spacePath(space.name)}`} key={space.name}>
                <SpaceIcon name={space.name} />
                <strong>{space.name}</strong>
                <span>
                  {space.work.filter((item) => item.state === "open").length}
                </span>
                <ArrowRight size={17} />
              </a>
            ))}
          </section>
        </>
      ) : (
        <section className="discovery-results">
          <div className="section-title">
            <h2>
              {lane
                ? buckets.find((bucket) => bucket.id === lane)?.label
                : "Across your ERA"}
              <span className="count">{found.length}</span>
            </h2>
            {lane && (
              <button
                className="plain-link"
                onClick={() => change({ lane: "" })}
              >
                All work
                <X size={13} />
              </button>
            )}
          </div>
          {found.length ? (
            found
              .slice(0, limit)
              .map((item) => (
                <WorkLink work={item} key={item.key} from={route.full} />
              ))
          ) : (
            <Empty title="Nothing here yet">
              <button
                className="secondary"
                onClick={() => change({ q: "", lane: "" })}
              >
                Start again
              </button>
            </Empty>
          )}
          {found.length > limit && (
            <button
              className="secondary load-more"
              onClick={() => setLimit(limit + 18)}
            >
              Show more <span>{found.length - limit}</span>
            </button>
          )}
        </section>
      )}
    </div>
  );
}
export function SpaceView({ name }: { name: string }) {
  const { world } = useWorld();
  const route = useRoute();
  const space = world.spaces.find((entry) => entry.name === name);
  const [historyLimit, setHistoryLimit] = useState(20);
  const story = route.query.get("tab") === "story";
  if (!space)
    return (
      <Empty title="This space is unavailable">
        <a href="#/">Home</a>
      </Empty>
    );
  const completed = space.work.filter((item) => item.state === "done");
  return (
    <div className="space-page">
      <Back label="Your ERA" />
      <header className="space-hero">
        <SpaceIcon name={name} size={38} />
        <div>
          <h1>{name}</h1>
          <p>{space.purpose.split(/\.\s/)[0]}</p>
        </div>
        <Distribution work={space.work} />
      </header>
      <div className="space-navigation">
        <button aria-pressed={!story} onClick={() => go(spacePath(name))}>
          What’s next
        </button>
        <button
          aria-pressed={story}
          onClick={() => go(`${spacePath(name)}?tab=story`)}
        >
          The story so far{" "}
          <span>{space.history.length + completed.length}</span>
        </button>
      </div>
      {story ? (
        <>
          {!!completed.length && (
            <details className="focus-disclosure">
              <summary>
                Completed · awaiting archive <span>{completed.length}</span>
              </summary>
              {completed.map((item) => (
                <WorkLink key={item.key} work={item} from={route.full} />
              ))}
            </details>
          )}
          <HistoryList entries={space.history} limit={historyLimit} />
          {space.history.length > historyLimit && (
            <button
              className="secondary load-more"
              onClick={() => setHistoryLimit(historyLimit + 20)}
            >
              More history
            </button>
          )}
          {!space.history.length && !completed.length && (
            <Empty title="The story starts here" />
          )}
        </>
      ) : (
        <Board
          work={space.work}
          basePath={spacePath(name)}
          lockCampaign={name}
        />
      )}
      {space.book && (
        <a
          className="source-link"
          href={`#/read?file=${encodeURIComponent(space.book.relPath)}&from=${encodeURIComponent(route.full)}`}
        >
          Open the full brief <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}
