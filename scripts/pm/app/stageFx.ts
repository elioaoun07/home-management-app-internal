import type { LocalActivityEvent } from "./localRunActivityModel";

const positions = {
  source: [180, 155],
  forge: [720, 155],
  lab: [720, 350],
  review: [180, 350],
  launch: [450, 420],
} as const;
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  packet: boolean;
  from: readonly number[];
};
/** Emission is strictly cue-triggered. No idle particle generator. */
export function createStageFx(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  const particles: Particle[] = [];
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 24;
  const pen = sprite.getContext("2d");
  const tint = getComputedStyle(canvas).color;
  if (pen) {
    const glow = pen.createRadialGradient(12, 12, 0, 12, 12, 12);
    glow.addColorStop(0, tint);
    glow.addColorStop(1, "transparent");
    pen.fillStyle = glow;
    pen.fillRect(0, 0, 24, 24);
  }
  return {
    resize() {
      const r = canvas.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    },
    emit(event: LocalActivityEvent) {
      const from = positions[event.station];
      const count =
        event.kind === "edit"
          ? 16
          : event.kind === "failure"
            ? 24
            : event.kind === "check"
              ? 10
              : 1;
      for (let i = 0; i < count && particles.length < 220; i++) {
        const angle = (i / count) * Math.PI * 2;
        particles.push({
          x: from[0],
          y: from[1],
          vx: Math.cos(angle) * 65,
          vy: Math.sin(angle) * 50,
          age: 0,
          life: i === 0 ? 0.65 : 0.7 + (i % 5) * 0.1,
          packet: i === 0,
          from,
        });
      }
    },
    draw(dt: number) {
      if (!ctx) return 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(canvas.width / 900, 0, 0, canvas.height / 470, 0, 0);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        const t = p.age / p.life;
        if (p.packet) {
          p.x = p.from[0] + (450 - p.from[0]) * t;
          p.y = p.from[1] + (240 - p.from[1]) * t;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 30 * dt;
        }
        ctx.globalAlpha = 1 - t;
        const size = p.packet ? 17 : 8;
        ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return particles.length;
    },
    clear() {
      particles.length = 0;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
