// src/components/ServiceWorkerRegistration.tsx
// Component to register the service worker on app startup

"use client";

import { useEffect, useRef } from "react";

// ============================================
// ALARM SOUND - Web Audio API
// ============================================

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  return audioContext;
}

function playBeep(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.5
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";

  gainNode.gain.setValueAtTime(volume, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playAlarmPattern(): { stop: () => void } {
  let stopped = false;
  let timeoutId: NodeJS.Timeout;

  const playLoop = () => {
    if (stopped) return;

    try {
      const ctx = getAudioContext();

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Urgent alarm pattern: alternating frequencies
      for (let i = 0; i < 3; i++) {
        playBeep(ctx, 880, now + i * 0.3, 0.1, 0.7); // A5
        playBeep(ctx, 1046, now + i * 0.3 + 0.15, 0.1, 0.7); // C6
      }

      // Schedule next loop
      if (!stopped) {
        timeoutId = setTimeout(playLoop, 1500);
      }
    } catch (error) {
      console.error("[Alarm] Failed to play:", error);
    }
  };

  playLoop();

  // Auto-stop after 10 seconds
  const autoStopId = setTimeout(() => {
    stopped = true;
    clearTimeout(timeoutId);
  }, 10000);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timeoutId);
      clearTimeout(autoStopId);
    },
  };
}

export function ServiceWorkerRegistration() {
  const alarmRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize audio context on first user interaction
    const initAudio = () => {
      try {
        getAudioContext();
        console.log("[Alarm] Audio context initialized");
      } catch (e) {
        console.warn("[Alarm] Could not initialize audio context:", e);
      }
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };

    document.addEventListener("click", initAudio, { once: true });
    document.addEventListener("touchstart", initAudio, { once: true });

    return () => {
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only register in production or when explicitly enabled
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SW === "true";

    if (!shouldRegister) {
      console.log("[SW] Skipping service worker registration in development");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("[SW] Service workers not supported");
      return;
    }

    // Register service worker
    registerServiceWorker();

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      const { type, url } = event.data || {};

      if (type === "NAVIGATE" && url) {
        // Navigate to URL requested by service worker
        window.location.href = url;
      } else if (type === "PLAY_ALARM_SOUND") {
        // Stop any existing alarm
        if (alarmRef.current) {
          alarmRef.current.stop();
        }
        // Play new alarm
        console.log("[Alarm] Playing alarm sound");
        alarmRef.current = playAlarmPattern();
      } else if (type === "STOP_ALARM_SOUND") {
        // Stop alarm
        if (alarmRef.current) {
          alarmRef.current.stop();
          alarmRef.current = null;
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      if (alarmRef.current) {
        alarmRef.current.stop();
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("[SW] Service worker registered:", registration.scope);

    // Check for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New service worker is ready, prompt user to refresh
            console.log("[SW] New version available");
            // Could show a toast here prompting user to refresh
          }
        });
      }
    });
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}
