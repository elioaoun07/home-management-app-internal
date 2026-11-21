import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BookOpen, BookText, Check, ChevronLeft, ChevronRight,
  Clock3, FileText, Layers3, ListChecks, LockKeyhole, Tablet, Target, Zap,
} from "lucide-react";
import { idSection } from "../shared/work-id.mjs";
import { read } from "./api";
import { identity, Markdown } from "./components";
import { pmKeys, useWorld } from "./state";
import { transport } from "./transport";
import { acceptanceMarkdown, fieldMarkdown } from "./workAcceptance";
import { cabinetMedium, cabinetShelves, libraryBrief, libraryDeliveryBlock, libraryPlanNotes, libraryShelves, type CabinetEntry } from "./libraryShelves";
import type { Space, Work, World } from "./types";
import "./library-cabinet.css";

interface CabinetProps {
  world: World;
  space: Space;
  selectedId: string | null;
  onSelectItem: (id: string | null) => void;
  onDeliver: (work: Work) => void;
  onExit: () => void;
}

const shelfIcons = { now: Zap, next: ArrowRight, waiting: LockKeyhole, later: Clock3, finished: Check };
const deviceIcons = { book: BookOpen, tablet: Tablet, glass: Layers3, folio: BookText };
const pages = ["Acceptance criteria", "Plan brief", "Checklist"] as const;

function Shelf({ shelf, entries, space, onSelect }: {
  shelf: (typeof cabinetShelves)[number];
  entries: CabinetEntry[];
  space: Space;
  onSelect: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ left: true, right: true });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft < 2, right = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      setEnds(old => old.left === left && old.right === right ? old : { left, right });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); };
  }, [entries.length]);
  const move = (direction: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const Icon = shelfIcons[shelf.id], Glyph = identity(space.name).icon;
  return <section className="lc-shelf" aria-label={shelf.name}>
    <header>
      <h2><Icon size={16} aria-hidden="true" />{shelf.name}<small>{entries.length}</small></h2>
      {(!ends.left || !ends.right) && <div className="lc-scroll">
        <button type="button" disabled={ends.left} aria-label={`Previous on ${shelf.name}`} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <button type="button" disabled={ends.right} aria-label={`More on ${shelf.name}`} onClick={() => move(1)}><ChevronRight size={18} /></button>
      </div>}
    </header>
    <div className="lc-track" ref={track}>
      {entries.length ? entries.map(entry => <button key={entry.id} type="button" className="lc-volume"
        data-volume={entry.id} onClick={() => onSelect(entry.id)}>
        <span className="lc-stamp"><span>{entry.id}</span><Glyph size={16} strokeWidth={1.5} aria-hidden="true" /></span>
        <strong>{entry.title}</strong>
      </button>) : <span className="lc-empty">Empty shelf</span>}
    </div>
  </section>;
}

function ItemReader({ entry, space, world, onBack, onDeliver }: {
  entry: CabinetEntry; space: Space; world: World; onBack: () => void; onDeliver: (work: Work) => void;
}) {
  const [page, setPage] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const pageStart = useRef<HTMLElement>(null);
  const { connected } = useWorld();
  const local = transport().capabilities.kind === "local";
  const currentBrief = useMemo(() => idSection(space.book?.raw, entry.id)?.body || entry.work?.contract || "", [space.book, entry.id, entry.work]);
  const archived = useQuery({
    queryKey: pmKeys.libraryRecord(space.name, entry.id),
    enabled: !!entry.receipt && !currentBrief && local && connected,
    queryFn: ({ signal }) => read<{ body: string | null; file: string | null }>(
      "/api/library/record?" + new URLSearchParams({ campaign: space.name, id: entry.id }), signal),
    staleTime: 300_000,
  });
  const raw = currentBrief || archived.data?.body || "";
  const source = currentBrief ? space.book?.relPath : archived.data?.file || entry.receipt?.file;
  const facts = useMemo(() => libraryBrief(raw), [raw]);
  const planNotes = useMemo(() => libraryPlanNotes(raw), [raw]);
  const criteria = useMemo(() => fieldMarkdown(raw, /^Acceptance(?: criteria)?$/i, "") ||
    acceptanceMarkdown(entry.work?.contract || raw), [raw, entry.work]);
  const currentWork = entry.work, receipt = entry.receipt, finished = entry.shelf === "finished";
  const block = useMemo(() => currentWork ? libraryDeliveryBlock(world, currentWork) : null, [currentWork, world]);
  const Resource = deviceIcons[cabinetMedium(space.name)];
  const shelf = cabinetShelves.find(s => s.id === entry.shelf)!;
  const missing = archived.isFetching ? "Loading archived brief…" : archived.isError ? "Archived brief unavailable."
    : receipt && !local ? "Archive available on the laptop." : receipt && !connected ? "Archive unavailable offline." : "Not recorded.";
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.closest("article")?.scrollIntoView({ block: "start" });
  }, []);
  const turn = (next: number) => {
    setPage(next);
    pageStart.current?.scrollIntoView({ block: "nearest" });
  };
  return <article className="lc-reader" aria-label={`${entry.id} reader`}>
    <button className="lc-back" onClick={onBack}><ArrowLeft size={16} />{space.name} shelves</button>
    <div className="lc-device">
      <header className="lc-device-head">
        <div className="lc-imprint"><Resource size={19} aria-hidden="true" />{space.name}<span>/</span>{entry.id}</div>
        <h1 ref={title} tabIndex={-1}>{entry.title}</h1>
        <div className="lc-reader-meta">
          <span>{shelf.name}{block && block !== shelf.name && <> · {block}</>}{receipt?.date && <> · <time>{receipt.date}</time></>}</span>
          {!finished && currentWork && <button className="primary" onClick={() => onDeliver(currentWork)}
            disabled={!connected || !!block}><Zap size={16} aria-hidden="true" />Deliver</button>}
        </div>
      </header>
      <nav aria-label="Item pages" className="lc-pages">{pages.map((name, i) =>
        <button key={name} type="button" aria-current={page === i ? "page" : undefined} onClick={() => turn(i)}>{name}</button>)}</nav>
      <section ref={pageStart} className="lc-leaf" aria-label={pages[page]}>
        <div className="lc-leaf-content" key={page}>
          {page === 0 && <>
            <h2><Target size={18} />What done looks like</h2>
            <p className="lc-outcome">{facts.outcome || currentWork?.outcome || entry.title}</p>
            <h3>Acceptance criteria</h3>
            {raw ? <>
              <Markdown raw={criteria} file={source || ""} />
              {!!facts.acceptance.length && <details><summary>Plan criteria</summary>
                <ul>{facts.acceptance.map((criterion, i) => <li key={i}>{criterion}</li>)}</ul></details>}
            </> : <p className="lc-note" role="status">{missing}</p>}
          </>}
          {page === 1 && <>
            <h2><FileText size={18} />Plan brief</h2>
            {facts.steps.length > 0 || planNotes ? <>
              {facts.steps.length > 0 ? <ol className="lc-steps">{facts.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
                : <Markdown raw={planNotes} file={source || ""} />}
              <details><summary>Full brief</summary><Markdown raw={raw} file={source || ""} /></details>
            </> : raw ? <Markdown raw={raw} file={source || ""} /> : <p className="lc-note" role="status">{missing}</p>}
          </>}
          {page === 2 && <>
            <h2><ListChecks size={18} />Checklist</h2>
            {currentWork && <><p className="lc-source-label">{space.name} · {currentWork.section}</p>
              <Markdown raw={currentWork.rawLine} file={currentWork.file} /></>}
            {receipt && <><h3>Completion record</h3><p>{entry.title}</p>{receipt.date && <time>{receipt.date}</time>}</>}
            {!!currentWork?.dependencies.length && <><h3>Prerequisites</h3><ul>
              {currentWork.dependencies.map(dep => <li key={dep.id}>{dep.id} · {dep.status}</li>)}</ul></>}
          </>}
        </div>
      </section>
      <footer className="lc-paging">
        <button disabled={page === 0} onClick={() => turn(page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
        <span>Page {page + 1} / {pages.length}</span>
        <button disabled={page === pages.length - 1} onClick={() => turn(page + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
      </footer>
    </div>
  </article>;
}

export function LibraryCabinet({ world, space, selectedId, onSelectItem, onDeliver, onExit }: CabinetProps) {
  const items = useMemo(() => libraryShelves(space, world.planningReadiness), [space, world.planningReadiness]);
  const selected = items.find(entry => entry.id.toUpperCase() === selectedId?.toUpperCase());
  const medium = cabinetMedium(space.name), Device = deviceIcons[medium];
  const lastSelection = useRef<string | null>(null);
  const shelves = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId) lastSelection.current = selectedId;
    else if (lastSelection.current) {
      const volume = shelves.current?.querySelector<HTMLButtonElement>(`[data-volume="${CSS.escape(lastSelection.current)}"]`);
      volume?.focus({ preventScroll: true });
      volume?.scrollIntoView({ block: "nearest", inline: "nearest" });
      lastSelection.current = null;
    }
  }, [selectedId]);
  return <div className="lc-cabinet" data-medium={medium} style={{ "--lc-accent": identity(space.name).color } as CSSProperties}>
    {selectedId ? selected ? <ItemReader key={selected.id} entry={selected} space={space} world={world}
      onBack={() => onSelectItem(null)} onDeliver={onDeliver} /> : <>
      <button className="lc-back" onClick={() => onSelectItem(null)}><ArrowLeft size={16} />{space.name} shelves</button>
      <h1>Item unavailable</h1>
    </> : null}
    <div ref={shelves} hidden={!!selectedId}>
      <button className="lc-back" onClick={onExit}><ArrowLeft size={16} />Library</button>
      <header className="lc-cabinet-head">
        <div className="lc-emblem"><Device size={30} strokeWidth={1.2} aria-hidden="true" /></div>
        <div><p className="lc-imprint">{items.length} {items.length === 1 ? "item" : "items"}</p><h1>{space.name}</h1></div>
      </header>
      {cabinetShelves.map(shelf => <Shelf key={shelf.id} shelf={shelf} space={space}
        entries={items.filter(entry => entry.shelf === shelf.id)} onSelect={onSelectItem} />)}
    </div>
  </div>;
}
