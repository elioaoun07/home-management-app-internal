"use client";

import { getAudioContext } from "./audioContext";

type PlaybackState = "idle" | "fetching" | "playing";

interface QueueEntry {
  text: string;
}

export const DEFAULT_TTS_VOICE = "en-US-AvaMultilingualNeural";

export function buildTTSSSML(text: string, voice = DEFAULT_TTS_VOICE): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}">${escaped}</voice></speak>`;
}

/**
 * Sentence-streaming TTS queue.
 * Splits incoming text on sentence boundaries, fetches MP3 from /api/tts per sentence,
 * decodes via Web Audio API, and plays them sequentially — audio starts before the full
 * response arrives. Uses AudioContext (autoplay-policy-safe) instead of HTMLAudioElement.
 */
export interface TTSQueue {
  push(text: string): void;
  flush(): void;
  stop(): void;
  readonly state: PlaybackState;
}

export function createTTSQueue(opts: {
  voice?: string;
  onStateChange?: (state: PlaybackState) => void;
  onSentenceStart?: (text: string) => void;
  onDone?: () => void;
}): TTSQueue {
  const voice = opts.voice ?? DEFAULT_TTS_VOICE;
  const queue: QueueEntry[] = [];
  let state: PlaybackState = "idle";
  let currentNode: AudioBufferSourceNode | null = null;
  let stopped = false;
  let buffer = "";
  let flushed = false;

  function setState(s: PlaybackState) {
    state = s;
    opts.onStateChange?.(s);
  }

  async function fetchAudio(text: string): Promise<Blob | null> {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssml: buildTTSSSML(text, voice) }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  async function processQueue() {
    if (stopped || queue.length === 0 || state === "playing" || state === "fetching") return;

    const entry = queue.shift()!;
    setState("fetching");

    const blob = await fetchAudio(entry.text);
    if (stopped) return;
    if (!blob) {
      setState("idle");
      processQueue();
      return;
    }

    setState("playing");
    opts.onSentenceStart?.(entry.text);

    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (stopped) return;

      const ac = getAudioContext();
      if (ac.state === "suspended") await ac.resume();
      if (stopped) return;

      const audioBuffer = await ac.decodeAudioData(arrayBuffer);
      if (stopped) return;

      const node = ac.createBufferSource();
      node.buffer = audioBuffer;
      node.connect(ac.destination);
      currentNode = node;

      node.onended = () => {
        currentNode = null;
        setState("idle");
        if (queue.length > 0) {
          processQueue();
        } else if (flushed) {
          opts.onDone?.();
        }
      };

      node.start();
    } catch {
      currentNode = null;
      setState("idle");
      processQueue();
    }
  }

  function extractSentences(): string[] {
    const sentences: string[] = [];
    const re = /[^.!?]*[.!?]+(?:\s|$)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = re.exec(buffer)) !== null) {
      sentences.push(match[0].trim());
      lastIndex = re.lastIndex;
    }
    buffer = buffer.slice(lastIndex);
    return sentences;
  }

  function enqueue(text: string) {
    if (!text.trim()) return;
    queue.push({ text });
    processQueue();
  }

  return {
    get state() {
      return state;
    },

    push(text: string) {
      if (stopped) return;
      buffer += text;
      const sentences = extractSentences();
      for (const s of sentences) enqueue(s);
    },

    flush() {
      flushed = true;
      const remaining = buffer.trim();
      buffer = "";
      if (remaining) enqueue(remaining);
      if (queue.length === 0 && state === "idle") {
        opts.onDone?.();
      }
    },

    stop() {
      stopped = true;
      try { currentNode?.stop(); } catch {}
      currentNode = null;
      queue.length = 0;
      buffer = "";
      setState("idle");
    },
  };
}
