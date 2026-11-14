/** Bounded, local burnout FX. Coordinates are relative to the 300-unit wheel. */
type Particle = {
  kind: "spark" | "flame" | "smoke";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  turn: number;
};

const LIMIT = 180;
const RANGE = 690;
const random = (min: number, max: number) => min + Math.random() * (max - min);

function plumeSprite(smoke: boolean) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (smoke) {
    glow.addColorStop(0, "rgba(151,145,156,.38)");
    glow.addColorStop(0.35, "rgba(115,103,121,.24)");
    glow.addColorStop(1, "rgba(74,64,80,0)");
  } else {
    glow.addColorStop(0, "rgba(255,249,207,1)");
    glow.addColorStop(0.18, "rgba(255,192,64,.95)");
    glow.addColorStop(0.45, "rgba(255,87,20,.65)");
    glow.addColorStop(1, "rgba(230,36,8,0)");
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return sprite;
}

export function createCoreParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  const smokeSprite = plumeSprite(true);
  const fireSprite = plumeSprite(false);
  const particles: Particle[] = [];
  let carry = 0;
  let serial = 0;

  function emit(angle: number, energy: number) {
    // Distributed orbital trails keep the energy around ERA's mark rather
    // than forming a ground-contact patch beneath a physical wheel.
    const a = (angle * Math.PI) / 180 + random(-Math.PI, Math.PI);
    const tangent = a + Math.PI / 2;
    const kind =
      serial % 9 === 0 ? "smoke" : serial % 3 === 0 ? "flame" : "spark";
    const speed =
      kind === "smoke" ? random(18, 45) : random(150, 320) * (0.5 + energy);
    const outward = kind === "spark" ? random(30, 120) : random(12, 44);
    particles.push({
      kind,
      x: Math.cos(a) * 114,
      y: Math.sin(a) * 114,
      vx: Math.cos(tangent) * speed + Math.cos(a) * outward,
      vy: Math.sin(tangent) * speed + Math.sin(a) * outward,
      age: 0,
      life: kind === "smoke" ? random(1.3, 2.1) : random(0.45, 1.05),
      size:
        kind === "smoke"
          ? random(28, 48)
          : kind === "flame"
            ? random(10, 20)
            : random(1, 2.6),
      turn: random(-1, 1),
    });
    serial += 1;
  }

  return {
    resize(wheelWidth: number) {
      const side = Math.max(
        1,
        Math.round(wheelWidth * 2.3 * Math.min(devicePixelRatio || 1, 1.75)),
      );
      if (canvas.width !== side) canvas.width = canvas.height = side;
    },
    clear() {
      particles.length = 0;
      carry = 0;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
    draw(dt: number, energy: number, angle: number) {
      if (!ctx) return 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = canvas.width / RANGE;
      ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
      // Fixed capacity + capped emissions prevent click storms growing memory.
      carry += dt * 160 * energy * energy;
      while (carry >= 1) {
        if (particles.length < LIMIT && energy > 0.035) emit(angle, energy);
        carry -= 1;
      }

      // Smoke behind the hot rim, sparks in front. Sprites avoid per-frame blur.
      for (const layer of ["smoke", "flame", "spark"] as const) {
        ctx.globalCompositeOperation =
          layer === "smoke" ? "source-over" : "lighter";
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          if (p.kind !== layer) continue;
          p.age += dt;
          if (p.age >= p.life) {
            particles.splice(i, 1);
            continue;
          }
          const drag = Math.exp(-dt * (layer === "smoke" ? 1.6 : 0.7));
          p.vx *= drag;
          p.vy =
            p.vy * drag +
            dt * (layer === "smoke" ? -95 : layer === "spark" ? 180 : -85);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const life = p.age / p.life;
          const fade =
            Math.sin((Math.min(1, life * 5) * Math.PI) / 2) *
            Math.pow(1 - life, 0.95);
          ctx.globalAlpha = fade;
          if (layer === "spark") {
            const tail = 0.025 + (1 - life) * 0.035;
            ctx.strokeStyle =
              life < 0.25 ? "#fff5c4" : life < 0.6 ? "#ffba4a" : "#f55621";
            ctx.lineWidth = p.size * (1 - life * 0.65);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          } else {
            const size =
              p.size * (layer === "smoke" ? 1 + life * 3.5 : 1 - life * 0.4);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.atan2(p.vy, p.vx) + p.turn * life);
            ctx.drawImage(
              layer === "smoke" ? smokeSprite : fireSprite,
              -size,
              -size * 0.55,
              size * 2,
              size * 1.1,
            );
            ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      return particles.length;
    },
  };
}
