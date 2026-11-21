import { ART, BUDGET } from "./config";
export function bakeGlow(
  color: string,
  size = ART.glow.size,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!,
    gradient = c.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(1, "transparent");
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  return canvas;
}
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
};
export function createBoardFx() {
  const particles: Particle[] = [];
  return {
    emit(x: number, y: number, count: number, cap: number = BUDGET.particles) {
      for (let i = 0; i < count && particles.length < cap; i++) {
        const a = i * 2.399;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * ART.spark.speed,
          vy: Math.sin(a) * ART.spark.speed - 15,
          age: 0,
          life: ART.spark.life + (i % 3) * 0.1,
          size: 5,
        });
      }
    },
    draw(
      c: CanvasRenderingContext2D,
      glow: HTMLCanvasElement,
      dt: number,
      cap: number,
    ) {
      if (particles.length > cap) particles.splice(0, particles.length - cap);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age > p.life) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += ART.spark.gravity * dt;
        c.globalAlpha = 1 - p.age / p.life;
        c.drawImage(glow, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      c.globalAlpha = 1;
      return particles.length;
    },
    clear() {
      particles.length = 0;
    },
    get count() {
      return particles.length;
    },
  };
}
