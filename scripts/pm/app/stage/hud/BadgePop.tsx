import { useEffect, useRef, useState } from "react";
import { Award } from "lucide-react";
import type { StageGameFacts } from "../game";
import { TIMING } from "../config";

export function BadgePop({
  badges,
  replay,
}: {
  badges: readonly StageGameFacts["badges"][number][];
  replay: boolean;
}) {
  const seen = useRef(new Set(badges.map((badge) => badge.id))),
    queue = useRef<string[]>([]),
    priorReplay = useRef(replay);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (replay && !priorReplay.current) {
      seen.current.clear();
      queue.current = [];
      setId(null);
    }
    priorReplay.current = replay;
    const earned = new Set(badges.map((badge) => badge.id));
    queue.current = queue.current.filter((value) => earned.has(value));
    for (const badge of badges)
      if (!seen.current.has(badge.id)) {
        seen.current.add(badge.id);
        queue.current.push(badge.id);
      }
    if (id && !earned.has(id)) setId(null);
    if (!id && queue.current.length) setId(queue.current.shift()!);
  }, [badges, replay, id]);
  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(
      () => setId(queue.current.shift() ?? null),
      TIMING.badge,
    );
    return () => clearTimeout(timer);
  }, [id]);
  const badge = badges.find((value) => value.id === id);
  return badge ? (
    <output className="board-badge-pop" role="status">
      <Award size={15} />
      {badge.label}
    </output>
  ) : null;
}
