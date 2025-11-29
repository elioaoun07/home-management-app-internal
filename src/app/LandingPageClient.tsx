"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock,
  DollarSign,
  PieChart,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Particle system for background
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  const colors = useMemo(
    () => ["#3b82f6", "#06b6d4", "#14b8a6", "#22d3ee", "#38bdf8"],
    []
  );

  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      const count = Math.min(80, Math.floor((width * height) / 15000));

      for (let i = 0; i < count; i++) {
        particles.push({
          id: i,
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      return particles;
    },
    [colors]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = initParticles(canvas.width, canvas.height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle) => {
        // Mouse interaction - subtle attraction
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          particle.x += dx * 0.002;
          particle.y += dy * 0.002;
        }

        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      // Draw connections between nearby particles
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}

// Animated counter component
function AnimatedCounter({
  end,
  duration = 2000,
  suffix = "",
  prefix = "",
}: {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [isVisible, end, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// Floating icon component
function FloatingIcon({
  icon: Icon,
  className,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "absolute p-3 rounded-2xl bg-[#0f1d2e]/80 backdrop-blur-sm border border-[#3b82f6]/20 shadow-lg shadow-[#06b6d4]/10",
        className
      )}
      style={{
        animation: `float 6s ease-in-out infinite`,
        animationDelay: `${delay}ms`,
      }}
    >
      <Icon className="w-6 h-6 text-[#06b6d4]" />
    </div>
  );
}

// Feature card with 3D tilt effect
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  delay?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    );
  };

  const handleMouseLeave = () => {
    setTransform("");
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group p-6 rounded-2xl bg-[#0f1d2e]/60 backdrop-blur-xl border border-[#3b82f6]/20 transition-all duration-300 hover:border-[#06b6d4]/40 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] cursor-default"
      style={{
        transform,
        transition: transform ? "none" : "all 0.5s ease-out",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#06b6d4]/20">
          <Icon className="w-7 h-7 text-[#06b6d4] drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
        </div>
        <div className="absolute -inset-2 bg-[#06b6d4]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-[#38bdf8]/70 leading-relaxed">{description}</p>
    </div>
  );
}

// Main hero icon with animated rings
function HeroIcon() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-8">
      {/* Outer pulsing ring */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20 animate-ping" />

      {/* Middle rotating ring */}
      <div
        className="absolute inset-2 rounded-3xl border-2 border-[#06b6d4]/30"
        style={{ animation: "spin 8s linear infinite" }}
      />

      {/* Inner glow ring */}
      <div className="absolute inset-4 rounded-2xl bg-gradient-to-br from-[#3b82f6]/30 to-[#14b8a6]/30 blur-sm" />

      {/* Main icon container */}
      <div className="absolute inset-4 rounded-2xl bg-gradient-to-br from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] flex items-center justify-center shadow-2xl shadow-[#06b6d4]/40">
        <Wallet className="w-12 h-12 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
      </div>

      {/* Sparkle effects */}
      <Sparkles
        className="absolute -top-2 -right-2 w-6 h-6 text-[#22d3ee] animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <Sparkles
        className="absolute -bottom-1 -left-1 w-5 h-5 text-[#3b82f6] animate-pulse"
        style={{ animationDelay: "500ms" }}
      />
    </div>
  );
}

// Scroll indicator
function ScrollIndicator() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
      <span className="text-[#38bdf8]/60 text-sm">Scroll to explore</span>
      <ChevronDown className="w-5 h-5 text-[#06b6d4]/60" />
    </div>
  );
}

export default function LandingPageClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1628] overflow-hidden">
      {/* Particle background */}
      {mounted && <ParticleBackground />}

      {/* Gradient overlays */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#3b82f6]/10 rounded-full blur-[120px] animate-blob" />
        <div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#06b6d4]/10 rounded-full blur-[100px] animate-blob"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#14b8a6]/5 rounded-full blur-[150px] animate-blob"
          style={{ animationDelay: "4s" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          {/* Floating decorative icons */}
          <FloatingIcon
            icon={DollarSign}
            className="top-[15%] left-[10%] hidden md:block"
            delay={0}
          />
          <FloatingIcon
            icon={TrendingUp}
            className="top-[20%] right-[15%] hidden md:block"
            delay={1000}
          />
          <FloatingIcon
            icon={PieChart}
            className="bottom-[25%] left-[8%] hidden md:block"
            delay={2000}
          />
          <FloatingIcon
            icon={BarChart3}
            className="bottom-[20%] right-[10%] hidden md:block"
            delay={3000}
          />

          <div className="max-w-5xl mx-auto text-center">
            {/* Animated hero icon */}
            <div
              className={cn(
                "transition-all duration-1000",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
            >
              <HeroIcon />
            </div>

            {/* Main headline with gradient */}
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 transition-all duration-1000 delay-200",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
            >
              <span className="text-white">Your Money,</span>
              <br />
              <span className="bg-gradient-to-r from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Your Control
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className={cn(
                "text-lg sm:text-xl md:text-2xl text-[#38bdf8]/70 max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-1000 delay-400",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
            >
              Experience the future of personal finance. Smart tracking,
              beautiful insights, and total control – all in one powerful app.
            </p>

            {/* CTA Buttons */}
            <div
              className={cn(
                "flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-600",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
            >
              <Button
                asChild
                size="lg"
                className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:from-[#2563eb] hover:to-[#0891b2] shadow-lg shadow-[#06b6d4]/30 hover:shadow-[#06b6d4]/50 transition-all duration-300 hover:scale-105 group"
              >
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 px-10 text-lg font-semibold border-[#3b82f6]/30 text-[#38bdf8] hover:bg-[#3b82f6]/10 hover:border-[#06b6d4]/50 transition-all duration-300"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div
              className={cn(
                "mt-16 flex flex-wrap justify-center gap-8 text-[#38bdf8]/50 text-sm transition-all duration-1000 delay-800",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Bank-level Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Instant Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>24/7 Available</span>
              </div>
            </div>
          </div>

          <ScrollIndicator />
        </section>

        {/* Stats Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: 50000, suffix: "+", label: "Active Users" },
                { value: 2, suffix: "M+", label: "Transactions" },
                { prefix: "$", value: 100, suffix: "M+", label: "Tracked" },
                { value: 99.9, suffix: "%", label: "Uptime" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent mb-2">
                    <AnimatedCounter
                      end={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                    />
                  </div>
                  <div className="text-[#38bdf8]/60 text-sm sm:text-base">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Everything You Need
              </h2>
              <p className="text-[#38bdf8]/70 text-lg max-w-2xl mx-auto">
                Powerful features designed to make managing your finances
                effortless and insightful
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={Zap}
                title="Lightning Fast"
                description="Add expenses in seconds with voice commands, quick templates, or simple taps"
                delay={0}
              />
              <FeatureCard
                icon={BarChart3}
                title="Smart Analytics"
                description="Visualize spending patterns with beautiful charts and AI-powered insights"
                delay={100}
              />
              <FeatureCard
                icon={Clock}
                title="Real-time Sync"
                description="Access your data anywhere with instant cloud synchronization across devices"
                delay={200}
              />
              <FeatureCard
                icon={Shield}
                title="Bank-level Security"
                description="Your data is encrypted and protected with industry-leading security standards"
                delay={300}
              />
              <FeatureCard
                icon={PieChart}
                title="Budget Goals"
                description="Set and track budgets for categories with smart alerts when you're close to limits"
                delay={400}
              />
              <FeatureCard
                icon={TrendingUp}
                title="Financial Insights"
                description="Get personalized recommendations and predictions based on your spending habits"
                delay={500}
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f1d2e] via-[#1a2942] to-[#0a1628]" />

              {/* Animated border */}
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background:
                    "linear-gradient(90deg, #3b82f6, #06b6d4, #14b8a6, #06b6d4, #3b82f6)",
                  backgroundSize: "400% 100%",
                  animation: "gradient 8s linear infinite",
                  padding: "2px",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />

              {/* Content */}
              <div className="relative p-12 text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                  Ready to Transform Your Finances?
                </h2>
                <p className="text-[#38bdf8]/70 text-lg mb-8 max-w-xl mx-auto">
                  Join thousands of users who have already taken control of
                  their financial future
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-12 text-lg font-semibold bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:from-[#2563eb] hover:to-[#0891b2] shadow-lg shadow-[#06b6d4]/30 hover:shadow-[#06b6d4]/50 transition-all duration-300 hover:scale-105"
                >
                  <Link href="/signup">Start Your Journey</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-[#3b82f6]/10">
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold text-lg">
                Budget Manager
              </span>
            </div>
            <p className="text-[#38bdf8]/50 text-sm">
              © {new Date().getFullYear()} Budget Manager. All rights reserved.
            </p>
          </div>
        </footer>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }

        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animate-gradient {
          animation: gradient 6s ease infinite;
        }
      `}</style>
    </div>
  );
}
