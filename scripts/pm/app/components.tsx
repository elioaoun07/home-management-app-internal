import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  HeartPulse,
  Layers3,
  MessageCircle,
  Plane,
  Smartphone,
  Sparkles,
  Utensils,
  Wallet,
  X,
  Shirt,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ERAMark, type ERAModuleKey } from "@/components/shared/ERAMark";
import { headingAnchors, resolveRelativeMd } from "../shared/links.mjs";
import { checklistAnchors } from "../shared/work-id.mjs";
import { sessionStatus, workTitle } from "../shared/product.mjs";
import { go, useRoute, useWorld } from "./state";
import {
  backPath,
  bucketOf,
  canDeliver,
  historyPath,
  runFor,
  spacePath,
  workPath,
} from "./model";
import type { Bucket, Receipt, RunSummary, Space, Work } from "./types";

const identities: Record<
  string,
  {
    icon: LucideIcon;
    color: string;
    wash: string;
    face: ERAModuleKey;
    short?: string;
  }
> = {
  "Hub & ERA": {
    icon: Sparkles,
    color: "#22d3ee",
    wash: "color-mix(in srgb, #22d3ee 12%, var(--surface))",
    face: "chat",
  },
  Budget: {
    icon: Wallet,
    color: "#2dd4bf",
    wash: "color-mix(in srgb, #2dd4bf 12%, var(--surface))",
    face: "financial",
  },
  Schedule: {
    icon: CalendarDays,
    color: "#a78bfa",
    wash: "color-mix(in srgb, #a78bfa 12%, var(--surface))",
    face: "schedule",
  },
  Kitchen: {
    icon: Utensils,
    color: "#fdba74",
    wash: "color-mix(in srgb, #fdba74 12%, var(--surface))",
    face: "recipe",
  },
  Trips: {
    icon: Plane,
    color: "#6ee7b7",
    wash: "color-mix(in srgb, #6ee7b7 12%, var(--surface))",
    face: "trip",
  },
  Healthcare: {
    icon: HeartPulse,
    color: "#f472b6",
    wash: "color-mix(in srgb, #f472b6 12%, var(--surface))",
    face: "health",
  },
  Outfits: {
    icon: Shirt,
    color: "#f9a8d4",
    wash: "color-mix(in srgb, #f9a8d4 12%, var(--surface))",
    face: "outfit",
  },
  "Notifications & Alerts": {
    icon: Bell,
    color: "#c4b5fd",
    wash: "color-mix(in srgb, #c4b5fd 12%, var(--surface))",
    face: "home",
    short: "Notifications",
  },
  Delivery: {
    icon: Zap,
    color: "#93c5fd",
    wash: "color-mix(in srgb, #93c5fd 12%, var(--surface))",
    face: "memory",
  },
  "Native App": {
    icon: Smartphone,
    color: "#38bdf8",
    wash: "color-mix(in srgb, #38bdf8 12%, var(--surface))",
    face: "home",
  },
  "PM Tooling": {
    icon: Layers3,
    color: "#a5b4fc",
    wash: "color-mix(in srgb, #a5b4fc 12%, var(--surface))",
    face: "memory",
    short: "Behind the scenes",
  },
};
export const identity = (name: string) =>
  identities[name] || {
    icon: Compass,
    color: "#38bdf8",
    wash: "color-mix(in srgb, #38bdf8 12%, var(--surface))",
    face: "home" as ERAModuleKey,
  };
export function SpaceIcon({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  const meta = identity(name);
  const Glyph = meta.icon;
  return (
    <span
      className="space-icon"
      style={
        {
          "--space-ink": meta.color,
          "--space-wash": meta.wash,
        } as CSSProperties
      }
    >
      <Glyph size={size} strokeWidth={1.65} />
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}
export function Back({
  fallback = "/",
  label = "Back",
}: {
  fallback?: string;
  label?: string;
}) {
  const route = useRoute();
  return (
    <a
      className="back"
      href={`#${backPath(route.query.get("from"), fallback)}`}
    >
      <ArrowLeft size={17} />
      {label}
    </a>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={28} strokeWidth={1.3} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Sheet({
  title,
  open,
  onClose,
  children,
  returnFocus,
  side = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  returnFocus?: RefObject<HTMLElement | null>;
  /** A right-hand panel on desktop; the phone keeps the bottom sheet. */
  side?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-shade" />
        <Dialog.Content className={side ? "sheet sheet-side" : "sheet"} aria-describedby={undefined} onCloseAutoFocus={(event) => {
          if (returnFocus?.current) { event.preventDefault(); returnFocus.current.focus(); }
        }}>
          <div className="sheet-title">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Markdown({ raw, file = "" }: { raw: string; file?: string }) {
  const anchors = new Map(
    headingAnchors(raw).map((entry) => [entry.line, entry.anchor]),
  );
  const checklistIds = new Map(
    checklistAnchors(raw).map((entry) => [entry.line, entry.anchor]),
  );
  const headingId = (node: ExtraProps["node"]) =>
    anchors.get((node?.position?.start.line || 1) - 1);
  const checklistId = (node: ExtraProps["node"]) =>
    checklistIds.get((node?.position?.start.line || 1) - 1);
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, children }) => <h1 id={headingId(node)}>{children}</h1>,
          h2: ({ node, children }) => <h2 id={headingId(node)}>{children}</h2>,
          h3: ({ node, children }) => <h3 id={headingId(node)}>{children}</h3>,
          h4: ({ node, children }) => <h4 id={headingId(node)}>{children}</h4>,
          li: ({ node, children }) => (
            <li id={checklistId(node)}>{children}</li>
          ),
          a: ({ href, children }) => {
            let target = href;
            if (file && href?.startsWith("#") && !href.startsWith("#/"))
              target = `#/read?file=${encodeURIComponent(file)}&anchor=${encodeURIComponent(href.slice(1))}`;
            try {
              const resolved = resolveRelativeMd(file, href);
              if (resolved)
                target = `#/read?file=${encodeURIComponent(resolved.relPath)}${resolved.anchor ? `&anchor=${encodeURIComponent(resolved.anchor)}` : ""}`;
            } catch {
              target = undefined;
            }
            return (
              <a href={target} rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {raw}
      </ReactMarkdown>
    </div>
  );
}
export function WorkLink({
  work,
  from,
  compact = false,
}: {
  work: Work;
  from: string;
  compact?: boolean;
}) {
  return (
    <motion.a
      className={`outcome-link ${compact ? "compact" : ""}`}
      href={`#${workPath(work, from)}`}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
    >
      <SpaceIcon name={work.module} size={19} />
      <WorkHeading work={work} detail={work.blocked ? "Waiting" : undefined} />
      <ArrowRight size={18} />
    </motion.a>
  );
}
export function WorkHeading({ work, detail }: { work: Work; detail?: string | null }) {
  const id = work.idChip || work.id;
  const repeated = work.title.slice(0, id.length).toUpperCase() === id.toUpperCase()
    && /^[\s·:—–]/u.test(work.title.slice(id.length));
  const title = repeated ? work.title.slice(id.length).replace(/^[\s·:—–-]+/u, "") : work.title;
  return (
    <span>
      <small>
        <span className="work-id">{work.label}</span> · {work.module}
        {detail ? ` · ${detail}` : ""}
      </small>
      <strong>{title}</strong>
    </span>
  );
}
export function Distribution({
  work,
  large = false,
}: {
  work: Work[];
  large?: boolean;
}) {
  const open = work.filter((item) => item.state === "open");
  const counts = ["Now", "Next", "Later"].map(
    (lane) => open.filter((item) => item.section === lane).length,
  );
  const colors = ["var(--accent)", "var(--chart-2)", "var(--chart-3)"];
  let offset = 0;
  return (
    <div
      className={`distribution ${large ? "large" : ""}`}
      role="img"
      aria-label={`${open.length} open: ${counts[0]} Now, ${counts[1]} Next, ${counts[2]} Later`}
    >
      <svg viewBox="0 0 120 120">
        <circle
          className="ring-track"
          cx="60"
          cy="60"
          r="48"
          fill="none"
          strokeWidth="10"
        />
        {counts.map((count, index) => {
          const ratio = open.length ? count / open.length : 0;
          const start = offset;
          offset += ratio;
          return (
            <circle
              key={index}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={colors[index]}
              strokeWidth="10"
              pathLength="100"
              strokeDasharray={`${Math.max(0, ratio * 100 - 2)} 100`}
              strokeDashoffset={-start * 100}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <span>
        <b>{open.length}</b>
        <small>open</small>
      </span>
    </div>
  );
}
export function SpaceShelf({
  spaces,
  runs = [],
}: {
  spaces: Space[];
  runs?: RunSummary[];
}) {
  const shelf = useRef<HTMLDivElement>(null);
  return (
    <section className="spaces-section">
      <div className="section-title">
        <h2>Your spaces</h2>
        <div className="shelf-controls">
          <button
            aria-label="Previous spaces"
            onClick={() =>
              shelf.current?.scrollBy({
                left: -380,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="More spaces"
            onClick={() =>
              shelf.current?.scrollBy({
                left: 380,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="space-shelf" ref={shelf}>
        {spaces.map((space) => {
          const meta = identity(space.name);
          const Icon = meta.icon;
          const open = space.work.filter((item) => item.state === "open");
          const now = open.filter((item) => bucketOf(item) === "now");
          const blocked = open.filter((item) => item.blocked).length;
          const active = open.some((item) => runFor(item, runs));
          const next = now[0];
          return (
            <motion.div
              key={space.name}
              className="space-cover"
              style={
                {
                  "--space-ink": meta.color,
                  "--space-wash": meta.wash,
                } as CSSProperties
              }
              whileHover={{ y: -4 }}
            >
              <a className="space-cover-main" href={`#${spacePath(space.name)}`}>
                <span className="cover-art">
                  <Icon size={38} strokeWidth={1.25} />
                  <i />
                  <i />
                </span>
                <strong>{meta.short || space.name}</strong>
                <span>{now.length ? `${now.length} in focus` : `${open.length} open`}</span>
                {(active || blocked > 0) && (
                  <span className="cover-badges">
                    {active && <em className="cover-badge cover-badge-active">Active</em>}
                    {blocked > 0 && <em className="cover-badge">{blocked} blocked</em>}
                  </span>
                )}
              </a>
              <a
                className="space-cover-action"
                href={`#${next ? workPath(next, spacePath(space.name)) : spacePath(space.name)}`}
              >
                {next ? next.title : "See what’s next"}
                <ArrowRight size={13} />
              </a>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
export function RunOrb({
  running,
  space = "Hub & ERA",
  size = 88,
}: {
  running: boolean;
  space?: string;
  size?: number;
}) {
  return (
    <div className="run-orb" data-running={running}>
      <ERAMark module={identity(space).face} size={size} />
    </div>
  );
}
export function RunLink({
  run,
  from = "/",
}: {
  run: RunSummary;
  from?: string;
}) {
  const { connected, runError } = useWorld();
  const running =
    connected &&
    !runError &&
    !!run.runnerAlive &&
    !run.awaiting &&
    !run.execution?.paused;
  return (
    <a
      className="run-link"
      href={`#/delivery/session/${run.sessionId}?from=${encodeURIComponent(from)}`}
    >
      <RunOrb running={running} space={run.item.campaign} size={48} />
      <span>
        <small>{sessionStatus(run)}</small>
        <strong>{workTitle(run.item)}</strong>
      </span>
      <span className="run-provider">V1 · {run.agent}</span>
      <ArrowRight size={18} />
    </a>
  );
}
export function HistoryList({
  entries,
  limit = 6,
}: {
  entries: Receipt[];
  limit?: number;
}) {
  const route = useRoute();
  return (
    <div className="history-list">
      {entries.slice(0, limit).map((entry) => (
        <a
          href={`#${entry.workId ? `/work/${encodeURIComponent(entry.campaign)}/${encodeURIComponent(entry.workId)}?from=${encodeURIComponent(route.full)}` : historyPath(entry)}`}
          className="history-entry"
          key={entry.key}
        >
          <span
            className={`history-check ${entry.status === "Shipped" ? "shipped" : ""}`}
          >
            {entry.status === "Shipped" ? <Check size={16} /> : <X size={16} />}
          </span>
          <div>
            <small>
              {entry.campaign} · {entry.date}
            </small>
            <p>{entry.text}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
export function BucketTabs({
  value,
  onChange,
  counts,
}: {
  value: Bucket;
  onChange: (bucket: Bucket) => void;
  counts: Record<Bucket, number>;
}) {
  return (
    <nav className="bucket-tabs" aria-label="Work timing">
      {(
        [
          ["now", "Now"],
          ["next", "Up next"],
          ["waiting", "Waiting"],
          ["later", "Someday"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
          <span>{counts[id]}</span>
          {value === id && <motion.i layoutId="bucket-selection" />}
        </button>
      ))}
    </nav>
  );
}
export function MoreLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="more-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
export const CaptureButton = ({ onClick }: { onClick: () => void }) => (
  <button className="capture-button" onClick={onClick}>
    <MessageCircle size={17} />
    <span>Capture</span>
  </button>
);
export function OutcomeButton({
  work,
  from,
  run,
  disabled,
}: {
  work: Work;
  from: string;
  run?: RunSummary;
  disabled?: boolean;
}) {
  if (work.state !== "open") return null;
  return run ? (
    <a
      className="primary"
      href={`#/delivery/session/${run.sessionId}?from=${encodeURIComponent(from)}`}
    >
      Follow delivery
      <ArrowRight size={17} />
    </a>
  ) : (
    <button
      className="primary deliver-button"
      disabled={disabled || !canDeliver(work)}
      onClick={() =>
        go(
          `/deliver/${encodeURIComponent(work.module)}/${encodeURIComponent(work.id)}?from=${encodeURIComponent(from)}`,
        )
      }
    >
      <Zap size={17} />
      Deliver
      <ArrowRight size={17} />
    </button>
  );
}
