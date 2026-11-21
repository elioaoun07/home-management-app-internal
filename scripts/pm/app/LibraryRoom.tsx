import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Footprints, LibraryBig } from "lucide-react";
import { identity } from "./components";
import { cabinetFace, librarySky } from "./libraryArt";
import type { LibraryAssets, LibraryWorld } from "./libraryWorld";
import "./library-room.css";

interface Cabinet {
  name: string;
  count: number;
}
interface Props {
  cabinets: readonly Cabinet[];
  initialCabinet?: string;
  onOpen(name: string): void;
}
const skyPath = "/app/assets/brain-room.js";
type SceneModule = Pick<typeof import("./libraryWorld"), "createLibraryWorld">;

function Paint({ image }: { image: HTMLCanvasElement }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { canvas.current?.getContext("2d")?.drawImage(image, 0, 0); }, [image]);
  return <canvas aria-hidden="true" ref={canvas} width={image.width} height={image.height} />;
}

function Gallery({ cabinets, initialCabinet, onOpen }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, cabinets.findIndex(cabinet => cabinet.name === initialCabinet)));
  const [design] = useState(() => cabinets.map(({ name }) => ({ name, color: identity(name).color })));
  const [assets, setAssets] = useState<LibraryAssets | null>(null);
  const [immersive, setImmersive] = useState(false);
  const host = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), world = useRef<LibraryWorld | null>(null);
  const controlsId = useId(), captionId = useId();
  const active = cabinets[index];
  const callbacks = useRef({ index, onOpen });
  callbacks.current = { index, onOpen };
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let alive = true;
    const artwork = { sky: librarySky(), faces: design.map(cabinetFace) };
    setAssets(artwork);
    const load = import(/* webpackIgnore: true */ skyPath) as Promise<SceneModule>;
    function useIllustration() {
      if (!alive) return;
      setImmersive(false);
      world.current?.dispose();
      world.current = null;
    }
    void load.then(module => {
      if (!alive || !module.createLibraryWorld) return;
      world.current = module.createLibraryWorld(container, design, artwork, callbacks.current.index,
        setIndex, i => callbacks.current.onOpen(design[i].name), useIllustration);
      setImmersive(true);
    }).catch(useIllustration);
    return () => {
      alive = false;
      world.current?.dispose();
      world.current = null;
    };
  }, [design]);
  useEffect(() => { world.current?.face(index); }, [index]);
  const wrapped = (i: number) => (i + cabinets.length) % cabinets.length;
  const directions = cabinets.length > 2 ? [-1, 0, 1] : cabinets.length === 2 ? [0, 1] : [0];
  return <section className="orbital-library" aria-labelledby={captionId} data-view={immersive ? "3d" : "illustrated"}>
    <header className="orbital-library-head">
      <div><LibraryBig size={23} aria-hidden="true" /><h1 id={captionId}>Library</h1></div>
      <span>{cabinets.length} {cabinets.length === 1 ? "cabinet" : "cabinets"}</span>
    </header>
    <div className="orbital-library-window" ref={viewport} tabIndex={0} role="region" aria-label="Library room"
      aria-describedby={controlsId} aria-keyshortcuts="ArrowLeft ArrowRight A D W S Enter"
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
        const k = event.key.toLowerCase();
        if (["arrowleft", "a", "arrowright", "d"].includes(k)) {
          event.preventDefault(); setIndex(i => wrapped(i + (k === "a" || k === "arrowleft" ? -1 : 1)));
        } else if (immersive && ["arrowup", "w", "arrowdown", "s"].includes(k)) {
          event.preventDefault(); world.current?.step(k === "w" || k === "arrowup" ? .44 : -.44);
        } else if (k === "enter") { event.preventDefault(); onOpen(active.name); }
      }}>
      <span id={controlsId} className="stage-announcement">Use left and right arrows to turn. Enter opens the cabinet.{immersive && " W and S move forward and back. Drag to look around."}</span>
      {!immersive && assets && <div className="orbital-illustration">
        <div className="orbital-painted-sky" style={{ "--sky-shift": `${(0.5 - index / cabinets.length + 1) % 1 * 100}%` } as CSSProperties}>
          <Paint image={assets.sky} />
        </div>
        <div className="orbital-window-ribs" />
        <div className="orbital-illustrated-floor" />
        {directions.map(offset => {
          const i = wrapped(index + offset);
          return <button key={offset} type="button" tabIndex={-1} aria-label={`Enter ${cabinets[i].name} cabinet`}
            data-side={offset} className="orbital-painted-cabinet" onClick={() => onOpen(cabinets[i].name)}>
            <Paint image={assets.faces[i]} />
          </button>;
        })}
      </div>}
      <div className="orbital-render" ref={host} onPointerDown={() => viewport.current?.focus({ preventScroll: true })} />
      <div className="orbital-visor" aria-live="polite">
        <button type="button" aria-label="Previous cabinet" disabled={cabinets.length === 1} onClick={() => setIndex(wrapped(index - 1))}><ChevronLeft size={19} /></button>
        <button type="button" className="orbital-enter" aria-label={`Open ${active.name} cabinet`} onClick={() => onOpen(active.name)}>
          <BookOpen size={17} aria-hidden="true" /><strong>{active.name}</strong><ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Next cabinet" disabled={cabinets.length === 1} onClick={() => setIndex(wrapped(index + 1))}><ChevronRight size={19} /></button>
      </div>
      {immersive && <span className="orbital-walk-hint" aria-hidden="true"><Footprints size={15} /> WASD · Drag to look</span>}
    </div>
    <nav className="orbital-directory" aria-label="Library cabinets">
      {cabinets.map(cabinet => {
        const { icon: Icon, color } = identity(cabinet.name);
        return <button type="button" key={cabinet.name} aria-label={cabinet.name}
          style={{ "--cabinet-color": color } as CSSProperties} onClick={() => onOpen(cabinet.name)}>
          <Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{cabinet.name}</span><small>{cabinet.count}</small>
        </button>;
      })}
    </nav>
  </section>;
}

export function LibraryRoom(props: Props) {
  if (!props.cabinets.length) return <section><h1>Library</h1><p>No cabinets available.</p></section>;
  return <Gallery key={JSON.stringify(props.cabinets.map(cabinet => cabinet.name))} {...props} />;
}
