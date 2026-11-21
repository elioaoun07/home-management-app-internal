import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { AttentionItem } from "../../localRunAttention";
import type { StageGameFacts } from "../game";
import { AttentionCard, type AttentionHandler } from "./AttentionCard";
import { HUD } from "../config";

export interface AttentionRailProps {
  items: readonly AttentionItem[];
  selectedId?: string | null;
  onAction?: AttentionHandler;
  canAct?: (item: AttentionItem) => boolean;
  actions?: ReactNode;
  results?: ReactNode;
  failure?: ReactNode;
  /** DLV-164: replaces the open question's card with an inline answer. */
  question?: ReactNode;
  badges: readonly StageGameFacts["badges"][number][];
  badgesOpen: boolean;
  onBadgesClose: () => void;
  onOpenChange?: (open: boolean) => void;
  renderAge?: (since: number | null) => ReactNode;
  stale?: boolean;
  open?: boolean;
  suppressAutoOpen?: boolean;
}

export const AttentionRail = memo(function AttentionRail({
  items,
  selectedId,
  onAction,
  canAct,
  actions,
  results,
  failure,
  question,
  badges,
  badgesOpen,
  onBadgesClose,
  onOpenChange,
  renderAge,
  stale = false,
  open: controlledOpen,
  suppressAutoOpen = false,
}: AttentionRailProps) {
  const openItems = useMemo(
      () => items.filter((item) => item.state === "open"),
      [items],
    ),
    done = items.filter((item) => item.state === "done");
  const act = useMemo(
    () => openItems.filter((item) => item.level === "act"),
    [openItems],
  );
  const [internalOpen, setInternalOpen] = useState(() =>
    !(typeof matchMedia !== "undefined" && matchMedia(`(max-width: ${HUD.railCollapseBelow - 1}px)`).matches) &&
    (openItems.length > 0 || !!results));
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback((next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  const root = useRef<HTMLElement>(null);
  const previousActs = useRef(new Set(act.map((item) => item.id)));
  const hadContent = useRef(openItems.length > 0 || !!results);
  const checkedInitialContent = useRef(false);
  useEffect(() => {
    const nextActs = new Set(act.map((item) => item.id));
    const content = openItems.length > 0 || !!results || badgesOpen;
    if ((!suppressAutoOpen && act.some((item) => !previousActs.current.has(item.id))) || badgesOpen)
      setOpen(true);
    else if (!content && (!checkedInitialContent.current || hadContent.current)) setOpen(false);
    previousActs.current = nextActs;
    hadContent.current = content;
    checkedInitialContent.current = true;
  }, [act, openItems.length, results, badgesOpen, suppressAutoOpen, setOpen]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "n" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable=true]"))
      )
        return;
      event.preventDefault();
      setOpen(true);
      root.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [setOpen]);
  const previousSelection = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const changed = selectedId !== previousSelection.current;
    previousSelection.current = selectedId;
    if (changed && selectedId && !suppressAutoOpen) setOpen(true);
  }, [selectedId, suppressAutoOpen, setOpen]);
  useLayoutEffect(() => {
    if (!open || !selectedId) return;
    const selected = root.current?.querySelector<HTMLElement>(
      `[data-attention-id="${CSS.escape(selectedId)}"]`,
    );
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [open, selectedId]);
  const failureItem = openItems.find((item) => item.kind === "failed");
  const questionItem = question ? openItems.find((item) => item.kind === "question") : undefined;
  const sql = openItems.filter((item) => item.kind === "sql"),
    sqlExtra = sql.slice(3);
  let sqlIndex = 0;
  return (
    <aside
      ref={root}
      className="board-rail"
      aria-label="NEEDS YOU"
      data-open={open}
      tabIndex={-1}
    >
      <header className="board-rail-heading">
        <button
          type="button"
          aria-label="NEEDS YOU"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          <span className="board-rail-label">NEEDS YOU ·</span><span className="board-rail-count">{act.length}</span>
        </button>
      </header>
      <div className="board-rail-body" hidden={!open}>
        {failure && failureItem ? (
          <div
            className="board-failure-card"
            data-attention-id={failureItem.id}
            data-kind={failureItem.kind}
            data-zone={failureItem.zone}
            data-level={failureItem.level}
            data-state={failureItem.state}
            data-selected={selectedId === failureItem.id}
            tabIndex={-1}
          >
            {failure}
          </div>
        ) : (
          results
        )}
        {questionItem && (
          <div
            className="board-question-card"
            data-attention-id={questionItem.id}
            data-kind="question"
            data-zone={questionItem.zone}
            data-level={questionItem.level}
            data-state={questionItem.state}
            data-selected={selectedId === questionItem.id}
            tabIndex={-1}
          >
            {question}
          </div>
        )}
        {openItems.map((item) => {
          if (item === failureItem && failure) return null;
          if (item === questionItem) return null;
          if (item.kind === "sql" && sqlIndex++ >= 3)
            return sqlIndex === 4 ? (
              <details className="board-sql-more" key="sql-extra">
                <summary>
                  <ChevronRight size={13} />+{sqlExtra.length}
                </summary>
                {sqlExtra.map((extra) => (
                  <AttentionCard
                    key={extra.id}
                    item={extra}
                    selected={selectedId === extra.id}
                    onAction={onAction}
                    canAct={canAct}
                    renderAge={renderAge}
                  />
                ))}
              </details>
            ) : null;
          return (
            <AttentionCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onAction={onAction}
              canAct={canAct}
              renderAge={renderAge}
            />
          );
        })}
        {done.length > 0 && (
          <details className="board-attention-done">
            <summary aria-label={`Done ${done.length}`}>
              <Check size={14} />
              {done.length}
            </summary>
            <ul>
              {done.map((item) => (
                <li
                  key={item.id}
                  data-attention-id={item.id}
                  data-kind={item.kind}
                  data-zone={item.zone}
                  data-state="done"
                >
                  <button
                    type="button"
                    onClick={() => onAction?.(item, "primary")}
                  >
                    {item.title}
                  </button>
                  {item.kind === "sql" && (
                    <button
                      type="button"
                      aria-label="Done"
                      aria-pressed="true"
                      onClick={() => onAction?.(item, "done")}
                    >
                      <Check size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        {badgesOpen && (
          <section className="board-badge-shelf">
            <header>
              <span>{badges.length}</span>
              <button type="button" aria-label="Close" onClick={onBadgesClose}>
                <PanelRightClose size={14} />
              </button>
            </header>
            <ul>
              {badges.map((badge) => (
                <li key={badge.id} tabIndex={0} title={badge.fact}>
                  {badge.label}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <footer className="run-game-commandbar" data-stale={stale} hidden={!open}>
        {actions}
      </footer>
    </aside>
  );
});
