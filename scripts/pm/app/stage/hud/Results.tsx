import { memo, type ReactNode } from "react";
import type { LocalScene } from "../../localRunScene";
import { clock } from "../../localRunLiveness";
import {
  localRunTokens,
  type StageGameFacts,
  type localBoardGame,
} from "../game";

type BoardGame = ReturnType<typeof localBoardGame>;
const titles: Record<string, string> = {
  shipped: "MISSION COMPLETE",
  "uat-ready": "READY FOR TEST",
  cancelled: "STOPPED",
  reverted: "Reverted",
};
export interface ResultsProps {
  snapshot: LocalScene;
  game: StageGameFacts;
  board: BoardGame;
  rank: boolean;
  debrief?: ReactNode;
}

export const Results = memo(function Results({
  snapshot,
  game,
  board,
  rank,
  debrief,
}: ResultsProps) {
  const title = titles[snapshot.phase],
    tokens = localRunTokens(snapshot.run.usage);
  const badges = [
    ...new Map(
      [...game.badges, ...board.badges].map((badge) => [badge.id, badge]),
    ).values(),
  ];
  if (!title || snapshot.run.interrupted) return null;
  return (
    <section className="board-results foundry-results" aria-label={title}>
      <h2>{title}</h2>
      {rank && game.rank && (
        <div
          className="board-rank foundry-rank"
          tabIndex={0}
          aria-label={`${game.rank} · ${game.rubric}`}
        >
          <strong>{game.rank}</strong>
          <small>{game.rubric}</small>
        </div>
      )}
      {debrief || (
        <dl className="board-result-numbers">
          {snapshot.elapsed !== null && (
            <div>
              <dt>Duration</dt>
              <dd>{clock(snapshot.elapsed)}</dd>
            </div>
          )}
          <div>
            <dt>Files</dt>
            <dd>
              {snapshot.counts.files}
              {game.completeHistory ? "" : "+"}
            </dd>
          </div>
          <div>
            <dt>Edits</dt>
            <dd>{snapshot.counts.edits}</dd>
          </div>
          <div>
            <dt>Gates</dt>
            <dd>{snapshot.counts.checks}/4</dd>
          </div>
        </dl>
      )}
      <dl className="board-result-numbers">
        <div>
          <dt>Commands</dt>
          <dd>{snapshot.counts.commands}</dd>
        </div>
        <div>
          <dt>Peak flow</dt>
          <dd>
            {game.peakCombo}
            {game.completeHistory ? "" : "+"}
          </dd>
        </div>
        {tokens !== null && !debrief && (
          <div>
            <dt>Tokens</dt>
            <dd>{tokens}</dd>
          </div>
        )}
      </dl>
      <dl className="board-splits" aria-label="Delivery stages">
        {board.splits.map((split) => (
          <div key={split.group}>
            <dt>{split.label}</dt>
            <dd>
              {clock(split.ms)}
              {split.partial ? "+" : ""}
            </dd>
          </div>
        ))}
      </dl>
      {badges.length > 0 && (
        <ul className="board-result-badges" aria-label="Badges">
          {badges.map((badge) => (
            <li key={badge.id} title={badge.fact}>
              {badge.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
