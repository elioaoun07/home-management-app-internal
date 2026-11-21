import { useEffect, useRef, type ReactNode } from "react";
import { Check, Radio } from "lucide-react";
import { bakeEra, drawEra } from "./stage/actors/era";
import { resolveStagePalette } from "./stage/palette";
import type { Work } from "./types";
import "./library-crew.css";

const operators = [{ id: "codex", name: "Codex" }, { id: "claude", name: "Claude" }] as const;

function Operator({ id, checking }: { id: string; checking: boolean }) {
  const portrait = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = portrait.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const draw = () => {
      const palette = resolveStagePalette(canvas.parentElement!);
      const facing = id === "codex" ? 1 : -1;
      const sprites = bakeEra({ ...palette, hull: palette.zones[id === "codex" ? "build" : "test"] });
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 132, 96);
      drawEra(ctx, sprites, 66, 83, 0, {
        gesture: checking ? "scan" : "wait", facing, static: true, extension: checking ? 1 : 0,
        target: { x: 63 * facing, y: -52 },
      });
    };
    draw();
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [id, checking]);
  return <span aria-hidden="true" className="library-crew-portrait">
    <span className="library-crew-plinth" />
    <canvas ref={portrait} width={264} height={192} />
  </span>;
}

export function LibraryCrew({ work, executor, onSelect, locked, checking, children }: {
  work: Work; executor: string; onSelect: (id: string) => void;
  locked: boolean; checking: boolean; children: ReactNode;
}) {
  return <section className="library-crew" aria-labelledby="library-crew-heading" data-checking={checking}>
    <header>
      <span className="eyebrow">{work.module} · {work.idChip || work.id}</span>
      <h1 id="library-crew-heading">Choose your operator</h1>
      <p>{work.title}</p>
    </header>
    <div className="library-crew-deck" role="group" aria-label="Delivery operator">
      {operators.map(({ id, name }) => <button type="button" key={id} data-operator={id}
        aria-pressed={executor === id} disabled={locked} onClick={() => onSelect(id)}>
        <Operator id={id} checking={checking && executor === id} />
        <span className="library-crew-name">{name}{executor === id && <Check size={16} aria-hidden="true" />}</span>
      </button>)}
    </div>
    {checking && <p className="library-crew-check" role="status"><Radio size={16} />Checking readiness…</p>}
    <div className="mission-controls">{children}</div>
  </section>;
}

