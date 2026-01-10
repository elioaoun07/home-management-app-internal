"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ThemeTransitionProps {
  isTransitioning: boolean;
  toTheme: "blue" | "pink" | "frost" | "calm";
  onPaintCovered: () => void | Promise<void>;
  onComplete: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
}

interface LiquidBlob {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
  speed: number;
}

export default function ThemeTransition({
  isTransitioning,
  toTheme,
  onPaintCovered,
  onComplete,
}: ThemeTransitionProps) {
  const [phase, setPhase] = useState<
    "idle" | "explosion" | "liquid" | "covered" | "dissolve" | "done"
  >("idle");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [blobs, setBlobs] = useState<LiquidBlob[]>([]);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const hasCoveredRef = useRef(false);

  const toColors = useMemo(
    () =>
      toTheme === "blue"
        ? {
            primary: "#06b6d4",
            secondary: "#3b82f6",
            tertiary: "#8b5cf6",
            bg: "#0a1628",
            bgDark: "#050d18",
            glow: "rgba(6, 182, 212, 0.8)",
            highlight: "#67e8f9",
            particle: [180, 200, 220], // HSL hue range
          }
        : toTheme === "frost"
          ? {
              primary: "#6366f1",
              secondary: "#8b5cf6",
              tertiary: "#a78bfa",
              bg: "#f8fafc",
              bgDark: "#f1f5f9",
              glow: "rgba(99, 102, 241, 0.5)",
              highlight: "#a5b4fc",
              particle: [240, 250, 260], // HSL hue range (indigo/violet)
            }
          : toTheme === "calm"
            ? {
                primary: "#78716c",
                secondary: "#a8a29e",
                tertiary: "#84a98c",
                bg: "#1c1917",
                bgDark: "#0c0a09",
                glow: "rgba(120, 113, 108, 0.6)",
                highlight: "#d6cfc7",
                particle: [30, 40, 50], // HSL hue range (warm stone)
              }
            : {
                primary: "#ec4899",
                secondary: "#f472b6",
                tertiary: "#a855f7",
                bg: "#1a0a14",
                bgDark: "#0d0509",
                glow: "rgba(236, 72, 153, 0.8)",
                highlight: "#fbcfe8",
                particle: [320, 340, 360], // HSL hue range
              },
    [toTheme]
  );

  // Metaball shader-like effect for liquid simulation
  const drawMetaballs = useCallback(
    (ctx: CanvasRenderingContext2D, blobs: LiquidBlob[], time: number) => {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Parse primary color based on theme
      const r =
        toTheme === "blue"
          ? 6
          : toTheme === "frost"
            ? 99
            : toTheme === "calm"
              ? 120
              : 236;
      const g =
        toTheme === "blue"
          ? 182
          : toTheme === "frost"
            ? 102
            : toTheme === "calm"
              ? 113
              : 72;
      const b =
        toTheme === "blue"
          ? 212
          : toTheme === "frost"
            ? 241
            : toTheme === "calm"
              ? 108
              : 153;

      // Simplified metaball - sample every 4 pixels for performance
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          let sum = 0;

          for (const blob of blobs) {
            const blobY =
              blob.y + Math.sin(time * blob.speed + blob.phase) * 20;
            const dx = x - blob.x;
            const dy = y - blobY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            sum += (blob.radius * blob.radius) / (dist * dist + 1);
          }

          if (sum > 1) {
            const alpha = Math.min(255, sum * 100);
            // Fill 4x4 block
            for (let fy = 0; fy < 4 && y + fy < height; fy++) {
              for (let fx = 0; fx < 4 && x + fx < width; fx++) {
                const idx = ((y + fy) * width + (x + fx)) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = alpha;
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [toTheme]
  );

  useEffect(() => {
    if (isTransitioning) {
      hasCoveredRef.current = false;
      setProgress(0);

      // Generate initial particles for explosion effect
      const newParticles: Particle[] = Array.from({ length: 100 }, (_, i) => {
        const angle = (i / 100) * Math.PI * 2;
        const speed = 5 + Math.random() * 10;
        return {
          id: i,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 10 + Math.random() * 30,
          opacity: 1,
          hue: toColors.particle[Math.floor(Math.random() * 3)],
          life: 1,
        };
      });
      setParticles(newParticles);

      // Generate liquid blobs
      const newBlobs: LiquidBlob[] = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: (i / 12) * window.innerWidth,
        y: -100 - Math.random() * 200,
        radius: 80 + Math.random() * 120,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
      }));
      setBlobs(newBlobs);

      // Start explosion
      setPhase("explosion");

      // Timeline
      const liquidTimer = setTimeout(() => setPhase("liquid"), 300);

      const coverTimer = setTimeout(async () => {
        setPhase("covered");
        if (!hasCoveredRef.current) {
          hasCoveredRef.current = true;
          await onPaintCovered();
        }
      }, 900);

      const dissolveTimer = setTimeout(() => setPhase("dissolve"), 1600);

      const completeTimer = setTimeout(() => {
        setPhase("done");
        setTimeout(() => {
          setPhase("idle");
          onComplete();
        }, 100);
      }, 2200);

      return () => {
        clearTimeout(liquidTimer);
        clearTimeout(coverTimer);
        clearTimeout(dissolveTimer);
        clearTimeout(completeTimer);
        cancelAnimationFrame(animationRef.current);
      };
    } else {
      setPhase("idle");
    }
  }, [isTransitioning, onPaintCovered, onComplete, toColors.particle]);

  // Canvas animation loop
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (phase === "explosion" || phase === "liquid") {
        // Draw expanding particles
        setParticles((prev) =>
          prev.map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.3, // gravity
            life: p.life - 0.02,
            opacity: Math.max(0, p.life),
          }))
        );

        particles.forEach((p) => {
          if (p.life > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.opacity * 0.8})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.5)`;
            ctx.fill();
          }
        });
      }

      if (phase === "liquid" || phase === "covered") {
        // Animate blobs falling
        setBlobs((prev) =>
          prev.map((b) => ({
            ...b,
            y: Math.min(b.y + 15, canvas.height * 0.6),
          }))
        );

        drawMetaballs(ctx, blobs, elapsed);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [phase, particles, blobs, drawMetaballs]);

  // Progress animation
  useEffect(() => {
    if (phase === "covered") {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 2, 100));
      }, 30);
      return () => clearInterval(interval);
    }
  }, [phase]);

  if (phase === "idle") return null;

  const isRevealing = phase === "dissolve" || phase === "done";

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
      <style>{`
        @keyframes portal-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        @keyframes portal-pulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
        }
        
        @keyframes ring-expand {
          0% { 
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% { 
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
          }
        }
        
        @keyframes liquid-wave {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0%); }
        }
        
        @keyframes liquid-retreat {
          0% { transform: translateY(0%) scaleY(1); }
          100% { transform: translateY(-100%) scaleY(0.5); }
        }
        
        @keyframes particle-float {
          0% { 
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% { 
            transform: translateY(-200px) scale(0);
            opacity: 0;
          }
        }
        
        @keyframes glitch-flicker {
          0%, 100% { opacity: 1; }
          33% { opacity: 0.8; transform: translateX(-2px); }
          66% { opacity: 0.9; transform: translateX(2px); }
        }
        
        @keyframes neon-glow {
          0%, 100% { 
            filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 20px var(--glow)) drop-shadow(0 0 40px var(--glow));
          }
          50% { 
            filter: drop-shadow(0 0 20px var(--glow)) drop-shadow(0 0 40px var(--glow)) drop-shadow(0 0 80px var(--glow));
          }
        }
        
        @keyframes text-reveal {
          0% { 
            clip-path: inset(0 100% 0 0);
            opacity: 0;
          }
          100% { 
            clip-path: inset(0 0 0 0);
            opacity: 1;
          }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        
        @keyframes dissolve-out {
          0% { 
            opacity: 1;
            filter: blur(0px);
          }
          100% { 
            opacity: 0;
            filter: blur(20px);
          }
        }
        
        @keyframes morph-blob {
          0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          50% { border-radius: 40% 60% 60% 40% / 40% 40% 60% 50%; }
          75% { border-radius: 60% 40% 50% 60% / 30% 60% 40% 70%; }
        }
        
        @keyframes progress-glow {
          0% { box-shadow: 0 0 5px var(--glow), 0 0 10px var(--glow); }
          50% { box-shadow: 0 0 20px var(--glow), 0 0 40px var(--glow), 0 0 60px var(--glow); }
          100% { box-shadow: 0 0 5px var(--glow), 0 0 10px var(--glow); }
        }
      `}</style>

      {/* Canvas for particle effects */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          opacity: isRevealing ? 0 : 1,
          transition: "opacity 0.3s ease-out",
        }}
      />

      {/* Main liquid fill - organic wave effect */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            ${toColors.highlight}22 0%,
            ${toColors.primary} 5%,
            ${toColors.secondary} 15%,
            ${toColors.bg} 40%,
            ${toColors.bgDark} 100%
          )`,
          animation: isRevealing
            ? "liquid-retreat 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards"
            : "liquid-wave 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          transformOrigin: "top center",
        }}
      >
        {/* Organic wavy top edge */}
        <svg
          className="absolute -top-1 left-0 w-full"
          style={{
            height: "120px",
            transform: "rotate(180deg)",
          }}
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="liquid-gradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={toColors.primary} stopOpacity="1" />
              <stop offset="100%" stopColor={toColors.bg} stopOpacity="1" />
            </linearGradient>
          </defs>
          <path
            fill="url(#liquid-gradient)"
            d="M0,64 C120,100 240,20 360,64 C480,110 600,0 720,64 C840,120 960,10 1080,64 C1200,110 1320,30 1440,64 L1440,120 L0,120 Z"
          >
            <animate
              attributeName="d"
              dur="2s"
              repeatCount="indefinite"
              values="
                M0,64 C120,100 240,20 360,64 C480,110 600,0 720,64 C840,120 960,10 1080,64 C1200,110 1320,30 1440,64 L1440,120 L0,120 Z;
                M0,32 C120,0 240,80 360,32 C480,0 600,100 720,32 C840,0 960,90 1080,32 C1200,0 1320,70 1440,32 L1440,120 L0,120 Z;
                M0,64 C120,100 240,20 360,64 C480,110 600,0 720,64 C840,120 960,10 1080,64 C1200,110 1320,30 1440,64 L1440,120 L0,120 Z
              "
            />
          </path>
        </svg>

        {/* Glossy reflection at top */}
        <div
          className="absolute top-0 left-0 right-0 h-40"
          style={{
            background: `linear-gradient(180deg, 
              rgba(255,255,255,0.15) 0%,
              rgba(255,255,255,0.03) 50%,
              transparent 100%
            )`,
          }}
        />

        {/* Shimmer effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-0 w-1/3"
            style={{
              background: `linear-gradient(90deg, 
                transparent 0%,
                rgba(255,255,255,0.15) 50%,
                transparent 100%
              )`,
              animation: "shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Floating morphing blobs */}
      {(phase === "liquid" || phase === "covered") && !isRevealing && (
        <>
          {blobs.slice(0, 6).map((blob, i) => (
            <div
              key={`morph-${blob.id}`}
              className="absolute"
              style={{
                left: `${10 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                width: `${blob.radius * 0.8}px`,
                height: `${blob.radius * 0.8}px`,
                background: `radial-gradient(circle at 30% 30%,
                  ${toColors.highlight}99 0%,
                  ${toColors.primary}66 50%,
                  transparent 100%
                )`,
                animation: `morph-blob ${2 + blob.speed}s ease-in-out infinite, particle-float ${3 + i * 0.5}s ease-out forwards`,
                animationDelay: `${i * 0.1}s`,
                filter: `blur(2px)`,
              }}
            />
          ))}
        </>
      )}

      {/* Portal rings effect */}
      {phase === "covered" && (
        <div className="absolute top-1/2 left-1/2">
          {[0, 1, 2].map((i) => (
            <div
              key={`ring-${i}`}
              className="absolute top-1/2 left-1/2 rounded-full border-2"
              style={{
                width: "200px",
                height: "200px",
                borderColor: toColors.primary,
                animation: `ring-expand 2s ease-out ${i * 0.5}s infinite`,
                opacity: 0,
              }}
            />
          ))}

          {/* Central portal glow */}
          <div
            className="absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: "180px",
              height: "180px",
              background: `radial-gradient(circle,
                ${toColors.glow} 0%,
                ${toColors.primary}44 40%,
                transparent 70%
              )`,
              animation: "portal-pulse 1.5s ease-in-out infinite",
              filter: `blur(10px)`,
            }}
          />
        </div>
      )}

      {/* Sparkle particles */}
      {phase === "covered" && (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${30 + Math.random() * 40}%`,
                width: "4px",
                height: "4px",
                background: toColors.highlight,
                borderRadius: "50%",
                boxShadow: `0 0 10px ${toColors.glow}, 0 0 20px ${toColors.primary}`,
                animation: `particle-float ${1 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                opacity: 0.8,
              }}
            />
          ))}
        </>
      )}

      {/* Center content with progress */}
      {phase === "covered" && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: "glitch-flicker 0.1s ease-in-out infinite" }}
        >
          <div className="text-center relative">
            {/* Background glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: "250px",
                height: "250px",
                background: `radial-gradient(circle, ${toColors.glow} 0%, transparent 60%)`,
                animation: "portal-pulse 2s ease-in-out infinite",
                filter: "blur(20px)",
              }}
            />

            {/* Theme icon with neon effect */}
            <div
              className="text-7xl relative z-10 mb-4"
              style={{
                ["--glow" as string]: toColors.glow,
                animation: "neon-glow 1s ease-in-out infinite",
              }}
            >
              {toTheme === "blue"
                ? "🌊"
                : toTheme === "frost"
                  ? "❄️"
                  : toTheme === "calm"
                    ? "🌿"
                    : "🌸"}
            </div>

            {/* Theme name with reveal animation */}
            <div
              className="text-2xl font-black tracking-[0.5em] uppercase relative z-10"
              style={{
                color: toColors.highlight,
                textShadow: `
                  0 0 10px ${toColors.glow}, 
                  0 0 20px ${toColors.glow},
                  0 0 40px ${toColors.primary},
                  0 0 80px ${toColors.primary}
                `,
                animation: "text-reveal 0.5s ease-out forwards",
              }}
            >
              {toTheme === "blue"
                ? "OCEAN"
                : toTheme === "frost"
                  ? "FROST"
                  : toTheme === "calm"
                    ? "CALM"
                    : "SUNSET"}
            </div>

            {/* Progress bar */}
            <div className="mt-8 relative z-10">
              <div
                className="w-48 h-1 mx-auto rounded-full overflow-hidden"
                style={{
                  background: `${toColors.bg}`,
                  border: `1px solid ${toColors.primary}33`,
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${toColors.secondary}, ${toColors.primary}, ${toColors.highlight})`,
                    ["--glow" as string]: toColors.glow,
                    animation: "progress-glow 1s ease-in-out infinite",
                  }}
                />
              </div>
              <div
                className="text-xs mt-2 tracking-widest uppercase"
                style={{ color: toColors.primary, opacity: 0.7 }}
              >
                Transforming...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dissolve effect overlay for reveal */}
      {isRevealing && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, 
              transparent 0%,
              ${toColors.bg}88 50%,
              ${toColors.bg} 100%
            )`,
            animation: "dissolve-out 0.6s ease-out forwards",
          }}
        />
      )}
    </div>
  );
}
