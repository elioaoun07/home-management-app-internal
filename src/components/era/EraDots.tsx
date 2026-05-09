"use client";

// src/components/era/EraDots.tsx
// Ambient floating dots — hidden while ERA is sleeping, born one by one on wake.
// Wrapper handles the birth fade-in; inner era-dot drives the steady pulse.

import type React from "react";
import { useEraStore } from "@/features/era/useEraStore";

const DOTS = [
  // Corner region — largest dots, like the app icon
  { left: "5%",  top: "10%", size: 6,   dur: "4.2s", delay: "0s"    },
  { left: "93%", top: "8%",  size: 5.5, dur: "5.1s", delay: "-1.4s" },
  { left: "4%",  top: "80%", size: 5,   dur: "3.8s", delay: "-2.8s" },
  { left: "92%", top: "82%", size: 6,   dur: "4.8s", delay: "-0.7s" },
  // Edge midpoints
  { left: "50%", top: "2%",  size: 4,   dur: "6.0s", delay: "-1.9s" },
  { left: "2%",  top: "50%", size: 3.5, dur: "4.5s", delay: "-3.5s" },
  { left: "97%", top: "52%", size: 4,   dur: "5.5s", delay: "-0.3s" },
  { left: "48%", top: "97%", size: 3.5, dur: "5.8s", delay: "-1.0s" },
  // Secondary accents
  { left: "18%", top: "4%",  size: 3,   dur: "3.6s", delay: "-3.2s" },
  { left: "80%", top: "16%", size: 3.5, dur: "4.4s", delay: "-0.9s" },
  { left: "14%", top: "93%", size: 3,   dur: "5.2s", delay: "-2.6s" },
  { left: "74%", top: "94%", size: 3,   dur: "4.0s", delay: "-2.1s" },
] as const;

export function EraDots() {
  const isAwake = useEraStore((s) => s.isAwake);
  if (!isAwake) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {DOTS.map((dot, i) => (
        // Wrapper drives the one-shot birth fade-in, staggered by index.
        // Inner div drives the steady pulse independently.
        <div
          key={i}
          className="era-dot-birth absolute"
          style={
            {
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              marginLeft: -dot.size / 2,
              marginTop: -dot.size / 2,
              "--birth-delay": `${i * 0.065}s`,
            } as React.CSSProperties
          }
        >
          <div
            className="era-dot absolute inset-0 rounded-full"
            style={
              {
                "--dot-dur": dot.dur,
                "--dot-delay": dot.delay,
              } as React.CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
