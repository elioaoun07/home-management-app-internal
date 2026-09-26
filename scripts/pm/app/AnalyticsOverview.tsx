import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { bucketOf, historyDays } from "./model";
import { Distribution, HistoryList } from "./components";
import type { Receipt, Work } from "./types";

/** Read-only summaries of the same filtered corpus used by the detailed charts. */
export function AnalyticsOverview({ work, history, campaign }: { work: Work[]; history: Receipt[]; campaign: string | null }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const days = historyDays(history);
  const max = Math.max(1, ...days.map((day) => day.count));
  const shipped = days.reduce((sum, day) => sum + day.count, 0);
  const recent = days.slice(7).reduce((sum, day) => sum + day.count, 0);
  const previous = shipped - recent;
  const open = work.filter((item) => item.state === "open");
  const now = open.filter((item) => bucketOf(item) === "now");
  const waiting = open.filter((item) => item.blocked);
  const queueHref = (lane: string) => `#/explore?lane=${lane}${campaign ? `&campaign=${encodeURIComponent(campaign)}` : ""}`;
  const dayRecords = history.filter((entry) => entry.status === "Shipped" && entry.datePrecision === "day" && entry.date === selectedDay);
  return (
    <>
      <section className="analytics-focus" aria-label="In focus">
        <div>
          <h2>In focus</h2>
          <a className="focus-count" href={queueHref("now")}><b>{now.length}</b><span>Ready in Now <ArrowRight size={15} /></span></a>
          <a className="plain-link" href={queueHref("waiting")}>{waiting.length} waiting <ArrowRight size={14} /></a>
        </div>
        <Distribution work={work} large />
        <div className="focus-priorities" aria-label="Open work by priority">
          {["Now", "Next", "Later"].map((lane) => <div key={lane}><i data-series={lane.toLowerCase()} /><span>{lane}</span><b>{open.filter((item) => item.section === lane).length}</b></div>)}
          <small>{new Set(open.map((item) => item.module)).size} spaces with open work</small>
        </div>
      </section>
      <section className="analytics-movement" aria-label="The last 14 days">
        <div className="section-title"><h2>The last 14 days</h2><strong>{shipped} shipped records</strong></div>
        <div className="movement-bars analytics-bars" role="img" aria-label={`${shipped} shipped records in the last 14 days; daily counts below`}>
          {days.map((day) => (
            <div key={day.date} title={`${day.date}: ${day.count} shipped records (UTC)`}>
              <span style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }} data-empty={!day.count} />
            </div>
          ))}
        </div>
        <div className="movement-dates"><span>{days[0].date}</span><span>UTC</span><span>{days[13].date}</span></div>
        <div className="movement-comparison"><span><b>{recent}</b> last 7 days</span><span><b>{previous}</b> previous 7 days</span></div>
        <details className="movement-days">
          <summary>Daily records</summary>
          {days.map((day) => <button key={day.date} aria-pressed={selectedDay === day.date} onClick={() => setSelectedDay(selectedDay === day.date ? null : day.date)}><span>{day.date}</span><b>{day.count}</b></button>)}
        </details>
        {selectedDay && (
          <div className="movement-records" aria-live="polite">
            <div className="section-title"><h3>{selectedDay}</h3><button className="plain-link" onClick={() => setSelectedDay(null)}>Close</button></div>
            {dayRecords.length ? <HistoryList entries={dayRecords} limit={dayRecords.length} /> : <small>No shipped records</small>}
          </div>
        )}
      </section>
    </>
  );
}
