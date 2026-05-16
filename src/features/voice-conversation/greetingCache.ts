"use client";

import { buildTTSSSML, DEFAULT_TTS_VOICE } from "./ttsQueue";
import { getWakeGreetingVariants } from "./speechTemplates";
import { getAudioContext } from "./audioContext";

const cache = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<void>>();
let lastPreloadedKey: string | null = null;

async function cacheOne(text: string, voice: string): Promise<void> {
  if (cache.has(text)) return;
  if (inflight.has(text)) return inflight.get(text)!;

  const p = (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssml: buildTTSSSML(text, voice) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const ab = await blob.arrayBuffer();
      const ac = getAudioContext();
      if (ac.state === "suspended") await ac.resume();
      const buf = await ac.decodeAudioData(ab);
      cache.set(text, buf);
    } catch {
      // Network or decode failure — cache miss, engine falls back to live TTS
    } finally {
      inflight.delete(text);
    }
  })();

  inflight.set(text, p);
  return p;
}

/**
 * Pre-fetches + decodes the 3 current-hour greeting variants into AudioBuffers.
 * Call after the AudioContext is unlocked (e.g., on first user click).
 * Safe to call multiple times — re-runs only when userName changes.
 */
export async function preloadGreetings(
  userName?: string,
  voice = DEFAULT_TTS_VOICE,
): Promise<void> {
  const key = userName ?? "";
  if (lastPreloadedKey === key) return;
  lastPreloadedKey = key;
  const variants = getWakeGreetingVariants(userName);
  await Promise.all(variants.map((v) => cacheOne(v, voice)));
}

/** Returns a cached AudioBuffer for the exact greeting text, or undefined on cache miss. */
export function getCachedGreeting(text: string): AudioBuffer | undefined {
  return cache.get(text);
}
