// Live proof of work for a running delivery (2026-09-19). Everything shown is
// recorded evidence, never a decorative guess: the elapsed clock starts at the
// job's `job.dispatched` event, each new activity row (a command, a message)
// produces a spike on the trace, and "last signal" counts from the newest record.
// A long silence is shown as quiet, not hidden behind the animation.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileSearch, MessageSquare, Terminal, Wrench } from "lucide-react";
import type { V2RunDetail } from "./types";

const QUIET_MS = 90_000;
const TRACE_POINTS = 48;
const TRACE_WINDOW_MS = 120_000;

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const ago = (ms: number) => (ms < 60_000 ? `${Math.max(0, Math.floor(ms / 1000))}s` : `${Math.floor(ms / 60_000)}m`);

/** Short, readable line for one activity record. */
export function activityLine(kind: string, summary: string | null) {
  const text = (summary || "").replace(/^\/bin\/sh -lc\s+/u, "").replace(/^["']|["']$/gu, "").replace(/\s+/gu, " ").trim();
  if (kind === "command") {
    const file = text.match(/(?:src|scripts|tests|migrations)\/[\w./[\]-]+/u)?.[0];
    if (/^(sed|cat|rg|grep|ls|head|tail|find)\b/u.test(text)) return file ? "Reading " + file.split("/").pop() : "Searching the code";
    if (/\b(vitest|tsc|test|eslint)\b/u.test(text)) return "Running checks";
    return file ? "Working on " + file.split("/").pop() : text.slice(0, 60);
  }
  if (kind === "file" || kind === "edit") return "Editing " + (text.split("/").pop() || "a file");
  const plain = text.replace(/```\w*/gu, "").trim();
  if (/^[{[]/u.test(plain)) return "Writing the summary";
  const first = plain.split(/(?<=[.!?])\s/u)[0] || "";
  return first.length > 70 ? first.slice(0, 68) + "…" : first || "Thinking";
}

const iconFor = (kind: string, line: string) =>
  kind === "command" ? (line.startsWith("Reading") || line.startsWith("Searching") ? FileSearch : Terminal) : kind === "file" || kind === "edit" ? Wrench : MessageSquare;

/** Activity timestamps → a heartbeat polyline: flat baseline with a spike per signal. */
export function tracePath(times: number[], now: number, width = 240, height = 44) {
  const mid = height * 0.62;
  const step = width / (TRACE_POINTS - 1);
  const buckets = new Array(TRACE_POINTS).fill(0);
  for (const at of times) {
    const age = now - at;
    if (age < 0 || age > TRACE_WINDOW_MS) continue;
    const index = TRACE_POINTS - 1 - Math.floor((age / TRACE_WINDOW_MS) * (TRACE_POINTS - 1));
    buckets[index] += 1;
  }
  return buckets
    .map((count, i) => {
      const x = (i * step).toFixed(1);
      if (!count) return `${x},${mid.toFixed(1)}`;
      const peak = Math.max(4, mid - Math.min(3, count) * (height * 0.19));
      return `${(i * step - step * 0.3).toFixed(1)},${(mid + 5).toFixed(1)} ${x},${peak.toFixed(1)} ${(i * step + step * 0.3).toFixed(1)},${(mid + 3).toFixed(1)}`;
    })
    .join(" ");
}

export function LivePulse({ detail, phase }: { detail: V2RunDetail; phase: string }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startedAt = useMemo(() => {
    const dispatched = [...detail.events].reverse().find((event) => event.kind === "job.dispatched");
    return dispatched ? Date.parse(dispatched.at) : null;
  }, [detail.events]);

  const signals = useMemo(() => {
    const times = [
      ...detail.activity.map((entry) => (entry.at ? Date.parse(entry.at) : NaN)),
      ...detail.events.map((event) => Date.parse(event.at)),
    ].filter((at) => Number.isFinite(at) && (!startedAt || at >= startedAt));
    return times.sort((a, b) => a - b);
  }, [detail.activity, detail.events, startedAt]);

  const recent = useMemo(
    () =>
      detail.activity
        .filter((entry) => !startedAt || (entry.at && Date.parse(entry.at) >= startedAt))
        .slice(-3)
        .map((entry, i) => {
          const line = activityLine(entry.kind, entry.summary);
          return { key: entry.job_id + ":" + (entry.at || i) + ":" + (entry.summary || "").slice(0, 40), line, Icon: iconFor(entry.kind, line) };
        }),
    [detail.activity, startedAt],
  );

  const steps = detail.activity.filter((entry) => !startedAt || (entry.at && Date.parse(entry.at) >= startedAt)).length;
  const last = signals.length ? signals[signals.length - 1] : startedAt;
  const silence = last ? now - last : null;
  const quiet = silence != null && silence > QUIET_MS;

  // A fresh signal flashes the beacon once.
  const seen = useRef(signals.length);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (signals.length > seen.current) setFlash((value) => value + 1);
    seen.current = signals.length;
  }, [signals.length]);

  return (
    <section className="live-pulse" data-quiet={quiet} aria-live="polite" aria-label="Live activity">
      <div className="live-pulse-head">
        <span className="live-beacon" aria-hidden="true">
          <i />
          {!reduced && (
            <motion.b
              key={flash}
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          )}
        </span>
        <strong>{quiet ? "Quiet" : phase}</strong>
        <span className="live-clock" title="Elapsed">
          {startedAt ? clock(now - startedAt) : "—"}
        </span>
      </div>

      <svg className="live-trace" viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="live-trace-ink" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.05" />
            <stop offset="0.7" stopColor="var(--accent)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="live-sweep-ink" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <polyline points={tracePath(signals, now)} fill="none" stroke="url(#live-trace-ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {!reduced && !quiet && <rect className="live-sweep" x="0" y="0" width="30" height="44" />}
      </svg>

      <ul className="live-feed">
          {recent.map(({ key, line, Icon }) => (
            <motion.li
              key={key}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Icon size={14} />
              <span>{line}</span>
            </motion.li>
          ))}
      </ul>

      <div className="live-foot">
        <span>{steps} steps</span>
        <span>{silence == null ? "Waiting for first signal" : "Last signal " + ago(silence)}</span>
      </div>
    </section>
  );
}
