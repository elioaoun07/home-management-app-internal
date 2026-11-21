import {
  BookOpen,
  Check,
  Database,
  FileCode2,
  ListChecks,
  MessageSquare,
  Radio,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AttentionItem } from "../../localRunAttention";
import { clock } from "../../localRunLiveness";
import { useBoardNow } from "../clockStore";

export type AttentionCommand = "primary" | "done" | "copy";
export type AttentionHandler = (
  item: AttentionItem,
  command?: AttentionCommand,
) => void;
export interface AttentionCardProps {
  item: AttentionItem;
  selected?: boolean;
  onAction?: AttentionHandler;
  canAct?: (item: AttentionItem) => boolean;
  renderAge?: (since: number | null) => ReactNode;
}
const icons = {
  plan: BookOpen,
  question: MessageSquare,
  summary: MessageSquare,
  test: ListChecks,
  review: FileCode2,
  changes: FileCode2,
  sql: Database,
  retry: RotateCw,
  failed: TriangleAlert,
  silent: Radio,
  lost: Radio,
};
function SilentDuration({ since }: { since: number }) {
  const now = useBoardNow();
  return clock(Math.max(0, now - since));
}

export function AttentionCard({
  item,
  selected = false,
  onAction,
  canAct,
  renderAge,
}: AttentionCardProps) {
  const Icon = icons[item.kind];
  const detail = item.kind === "changes" ? item.detail?.replace(/\bfiles\b/gu, "kept") : item.detail;
  const age =
    item.since === null
      ? null
      : `${Math.max(0, Math.floor((Date.now() - item.since) / 60000))}m`;
  return (
    <article
      className="board-attention-card"
      data-attention-id={item.id}
      data-kind={item.kind}
      data-level={item.level}
      data-zone={item.zone}
      data-state={item.state}
      data-selected={selected}
      data-blocking={item.blocking || undefined}
      tabIndex={-1}
    >
      <header>
        <Icon size={16} />
        <h3>{item.title}</h3>
        {item.since !== null && (
          <span className="board-attention-age">
            {renderAge ? renderAge(item.since) : age}
          </span>
        )}
      </header>
      {item.detail && (
        <p className="board-attention-detail" title={detail}>
          {item.kind === "silent" && item.since !== null ? (
            <SilentDuration since={item.since} />
          ) : (
            detail
          )}
        </p>
      )}
      {selected && !!item.choices?.length && (
        <ul className="board-question-choices">
          {item.choices.map((choice) => (
            <li
              key={choice.answer}
              data-recommended={choice.recommended || undefined}
            >
              {choice.label}
            </li>
          ))}
        </ul>
      )}
      <div className="board-attention-actions">
        {item.action.run !== "none" &&
          (item.action.href ? (
            <a
              className="primary"
              href={item.action.href}
              onClick={() => onAction?.(item, "primary")}
            >
              {item.action.label}
            </a>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={canAct?.(item) === false}
              onClick={() => onAction?.(item, "primary")}
            >
              {item.action.label}
            </button>
          ))}
        {item.kind === "sql" && (
          <button
            type="button"
            className="secondary"
            aria-pressed={item.state === "done"}
            onClick={() => onAction?.(item, "done")}
          >
            <Check size={13} />
            Done
          </button>
        )}
      </div>
    </article>
  );
}
