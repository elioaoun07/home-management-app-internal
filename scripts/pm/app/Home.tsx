import { ArrowRight, CircleDot, Clock3, Lightbulb, MoveUpRight, Plus, Sprout } from "lucide-react";
import { useWorld } from "./state";
import { bucketOf, buckets, liveRuns } from "./model";
import { HistoryList, PageTitle, RunLink, SpaceShelf, WorkLink } from "./components";

const queueIcons = { now: CircleDot, next: MoveUpRight, waiting: Clock3, later: Sprout };

export function Home({ capture }: { capture: () => void }) {
  const { world, runs, runError } = useWorld();
  const active = liveRuns(runs);
  const waiting = active.filter((run) => run.awaiting);
  const open = world.work.filter((item) => item.state === "open");
  const now = open.filter((item) => bucketOf(item) === "now");
  return (
    <div className="today-page">
      <PageTitle
        eyebrow={new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        title="Your ERA."
        action={<button className="round-button" aria-label="Capture an idea" onClick={capture}><Plus size={21} /></button>}
      />
      {runError && !active.length && <a className="plain-link" href="#/delivery">Delivery status unavailable <ArrowRight size={14} /></a>}
      {active.length > 0 && (
        <section className="live-ribbon" aria-label="Active Delivery">
          <RunLink run={waiting[0] || active[0]} />
          {active.length > 1 && <a className="more-runs" href="#/delivery">+{active.length - 1} more</a>}
          {runError && <small className="stale-label">Last known state</small>}
        </section>
      )}
      <section className="home-queues" aria-label="Work queues">
        <div className="section-title"><h2>Your work</h2><a href="#/explore">View all <ArrowRight size={15} /></a></div>
        <div className="work-collections">
          {buckets.map((bucket) => {
            const Icon = queueIcons[bucket.id];
            const count = open.filter((item) => bucketOf(item) === bucket.id).length;
            return (
              <a key={bucket.id} className={`work-collection collection-${bucket.id}`} href={`#/explore?lane=${bucket.id}`}>
                <span className="queue-card-top"><Icon size={22} strokeWidth={1.6} /><b>{count}</b></span>
                <div><strong>{bucket.label}</strong></div>
                <ArrowRight size={17} />
              </a>
            );
          })}
        </div>
      </section>
      {world.choices.length > 0 && (
        <a className="home-decisions" href="#/attention"><Lightbulb size={18} /><strong>Open choices</strong><span>{world.choices.length}</span><ArrowRight size={16} /></a>
      )}
      <SpaceShelf spaces={world.spaces} runs={runs} />
      <section className="next-section">
        <div className="section-title"><h2>A place to begin</h2><a href="#/explore?lane=now">See all <ArrowRight size={15} /></a></div>
        <div className="home-outcomes">{now.slice(0, 3).map((work) => <WorkLink key={work.key} work={work} from="/" />)}</div>
        {!now.length && <a className="plain-link" href="#/explore">Explore your work <ArrowRight size={15} /></a>}
      </section>
      <details className="recent-disclosure"><summary>Recently changed</summary><HistoryList entries={world.history} limit={3} /></details>
    </div>
  );
}
