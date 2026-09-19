import { ArrowRight, CircleDot, Lightbulb, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useWorld } from "./state";
import { bucketOf, historyDays, liveRuns } from "./model";
import {
  Distribution,
  HistoryList,
  PageTitle,
  RunLink,
  SpaceShelf,
  WorkLink,
} from "./components";

export function Home({ capture }: { capture: () => void }) {
  const { world, runs, runError } = useWorld();
  const active = liveRuns(runs);
  const waiting = active.filter((run) => run.awaiting);
  const now = world.work.filter(
    (item) => item.state === "open" && bucketOf(item) === "now",
  );
  const days = historyDays(world.history);
  const max = Math.max(1, ...days.map((day) => day.count));
  const shipped = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className="today-page">
      <PageTitle
        eyebrow={new Date().toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title="Your ERA."
        action={
          <button
            className="round-button"
            aria-label="Capture an idea"
            onClick={capture}
          >
            <Plus size={21} />
          </button>
        }
      />
      {runError && !active.length && (
        <a className="plain-link" href="#/delivery">
          Delivery status unavailable <ArrowRight size={14} />
        </a>
      )}
      {active.length > 0 && (
        <section className="live-ribbon" aria-label="Active Delivery">
          <RunLink run={waiting[0] || active[0]} />
          {active.length > 1 && (
            <a className="more-runs" href="#/delivery">
              +{active.length - 1} more
            </a>
          )}
          {runError && <small className="stale-label">Last known state</small>}
        </section>
      )}
      <section className="daily-composition">
        <div className="focus-story">
          <span className="eyebrow">
            <CircleDot size={13} />
            In focus
          </span>
          <a href="#/explore?lane=now">
            <strong>{now.length}</strong>
            <h2>
              next steps.
              <br />
              One at a time.
            </h2>
            <span>
              Find your next move <ArrowRight size={17} />
            </span>
          </a>
        </div>
        <div className="world-balance">
          <Distribution work={world.work} large />
          <div className="ring-legend">
            <span>
              <i />
              Now
            </span>
            <span>
              <i />
              Next
            </span>
            <span>
              <i />
              Later
            </span>
          </div>
        </div>
        <a className="attention-summary" href="#/attention">
          <span>
            <Lightbulb size={21} />
            <b>{world.choices.length + waiting.length}</b>
          </span>
          <strong>Waiting for you</strong>
          <small>
            {waiting.length
              ? `${waiting.length} delivery reviews`
              : `${world.choices.length} open choices`}
          </small>
          <ArrowRight size={18} />
        </a>
      </section>
      <SpaceShelf spaces={world.spaces} runs={runs} />
      <section className="next-section">
        <div className="section-title">
          <h2>A place to begin</h2>
          <a href="#/explore?lane=now">
            See all <ArrowRight size={15} />
          </a>
        </div>
        <div className="home-outcomes">
          {now.slice(0, 3).map((work) => (
            <WorkLink key={work.key} work={work} from="/" />
          ))}
        </div>
        {!now.length && (
          <a className="plain-link" href="#/explore">
            Explore your work <ArrowRight size={15} />
          </a>
        )}
      </section>
      <section className="movement-section">
        <div className="movement-heading">
          <span className="eyebrow">The last 14 days</span>
          <h2>
            <b>{shipped}</b> shipped records.
          </h2>
          <a href="#/dashboard">
            Dashboard <ArrowRight size={15} />
          </a>
          <a href="#/activity">
            See the story <ArrowRight size={15} />
          </a>
        </div>
        <div
          className="movement-bars"
          role="img"
          aria-label={`${shipped} dated shipped records in the last fourteen days`}
        >
          {days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} shipped records`}
            >
              <motion.span
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.45 }}
                style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
                data-empty={!day.count}
              />
            </div>
          ))}
        </div>
      </section>
      <details className="recent-disclosure">
        <summary>Recently changed</summary>
        <HistoryList entries={world.history} limit={3} />
      </details>
    </div>
  );
}
