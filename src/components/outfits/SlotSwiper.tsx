"use client";

// The outfit-change primitive: one horizontal swiper per body slot.
//
// Smoothness contract:
// - Scrolling is NATIVE CSS scroll-snap — it runs on the compositor thread,
//   which no JS-driven drag can match on mobile. Framer only decorates.
// - The scale/opacity parallax is driven by useScroll + useTransform motion
//   values: GPU transform/opacity only, zero React re-renders during scroll.
// - Anti-glitch: every cell is a fixed-size box (no layout shift), the
//   selected cell ±1 decode eagerly, everything else lazily.
// - Reduced motion: parallax off, swiper stays fully functional.

import type { WardrobeItem } from "@/features/outfits/types";
import { cn } from "@/lib/utils";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Ban } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";

interface SlotSwiperProps {
  items: WardrobeItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  getUrl: (path: string | null | undefined) => string | null;
  /** Row height comes from the paper-doll layout. */
  className?: string;
  /** Accessible name, e.g. "Tops". */
  label: string;
}

export default function SlotSwiper({
  items,
  selectedId,
  onSelect,
  getUrl,
  className,
  label,
}: SlotSwiperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollX } = useScroll({ container: containerRef });
  const prefersReduced = useReducedMotion();

  // Cell order: [none, ...items]. committedIndex tracks what the swiper last
  // reported so programmatic scrolls and user swipes don't fight.
  const cellIds = useMemo<(string | null)[]>(
    () => [null, ...items.map((i) => i.id)],
    [items],
  );
  const committedIndexRef = useRef(0);
  const selectedIndex = Math.max(0, cellIds.indexOf(selectedId));

  const commitNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.children.length === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== committedIndexRef.current) {
      committedIndexRef.current = best;
      const id = cellIds[best] ?? null;
      if (id !== selectedId) {
        navigator.vibrate?.(10);
        onSelect(id);
      }
    }
  }, [cellIds, onSelect, selectedId]);

  // Selection detection: scrollend where supported, debounced scroll fallback.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let t: number | undefined;
    const onScroll = () => {
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(commitNearest, 120);
    };
    const onScrollEnd = () => {
      if (t !== undefined) window.clearTimeout(t);
      commitNearest();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd);
      if (t !== undefined) window.clearTimeout(t);
    };
  }, [commitNearest]);

  // Programmatic alignment (loading an outfit, external clears).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (selectedIndex === committedIndexRef.current) return;
    const child = el.children[selectedIndex] as HTMLElement | undefined;
    if (!child) return;
    committedIndexRef.current = selectedIndex;
    el.scrollTo({
      left: child.offsetLeft + child.offsetWidth / 2 - el.clientWidth / 2,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }, [selectedIndex, prefersReduced, items.length]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={label}
      className={cn(
        "flex overflow-x-auto scrollbar-hide snap-x snap-mandatory",
        "[overscroll-behavior-x:contain] [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {/* Leading "none" cell empties the slot */}
      <SwiperCell
        scrollX={scrollX}
        containerRef={containerRef}
        parallax={!prefersReduced}
        onTap={() => onSelect(null)}
        selected={selectedId === null}
        ariaLabel={`No ${label}`}
      >
        <div className="flex flex-col items-center gap-1 opacity-40">
          <Ban className="w-5 h-5 text-white/60" />
          <span className="text-[10px] text-white/60">none</span>
        </div>
      </SwiperCell>

      {items.map((item, idx) => {
        const url = getUrl(item.cutout_path ?? item.image_path);
        const near = Math.abs(idx + 1 - selectedIndex) <= 1;
        return (
          <SwiperCell
            key={item.id}
            scrollX={scrollX}
            containerRef={containerRef}
            parallax={!prefersReduced}
            onTap={() => onSelect(item.id)}
            selected={selectedId === item.id}
            ariaLabel={item.name}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={item.name}
                decoding="async"
                loading={near ? "eager" : "lazy"}
                draggable={false}
                className="max-w-full max-h-full object-contain select-none"
              />
            ) : (
              <span className="text-[10px] text-white/40 px-2 text-center">{item.name}</span>
            )}
          </SwiperCell>
        );
      })}
    </div>
  );
}

function SwiperCell({
  scrollX,
  containerRef,
  parallax,
  onTap,
  selected,
  ariaLabel,
  children,
}: {
  scrollX: MotionValue<number>;
  containerRef: RefObject<HTMLDivElement | null>;
  parallax: boolean;
  onTap: () => void;
  selected: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const geomRef = useRef({ center: 0, width: 1, containerW: 1 });

  useEffect(() => {
    const measure = () => {
      const cell = cellRef.current;
      const cont = containerRef.current;
      if (!cell || !cont) return;
      geomRef.current = {
        center: cell.offsetLeft + cell.offsetWidth / 2,
        width: Math.max(1, cell.offsetWidth),
        containerW: cont.clientWidth,
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (cellRef.current) ro.observe(cellRef.current);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

  const distance = (x: number) => {
    const g = geomRef.current;
    return Math.abs(x + g.containerW / 2 - g.center) / g.width;
  };
  const scale = useTransform(scrollX, (x) => Math.max(0.86, 1 - distance(x) * 0.14));
  const opacity = useTransform(scrollX, (x) => Math.max(0.4, 1 - distance(x) * 0.6));

  return (
    <motion.div
      ref={cellRef}
      role="option"
      aria-selected={selected}
      aria-label={ariaLabel}
      onClick={onTap}
      style={parallax ? { scale, opacity } : undefined}
      className="w-[64%] shrink-0 snap-center h-full flex items-center justify-center px-2 first:ml-[18%] last:mr-[18%]"
    >
      {children}
    </motion.div>
  );
}
