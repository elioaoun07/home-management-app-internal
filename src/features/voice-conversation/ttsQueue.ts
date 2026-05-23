"use client";

import { createAzureTTSPlayer } from "./azureTTS";

export type PlaybackState = "idle" | "fetching" | "playing";

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
 * Sentence-streaming TTS queue backed by the Azure Speech SDK.
 * Splits incoming text on sentence boundaries, synthesizes via Azure PCM streaming,
 * and plays sequentially — audio starts before the full LLM response arrives.
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
  let currentPlayer: ReturnType<typeof createAzureTTSPlayer> | null = null;
  let stopped = false;
  let buffer = "";
  let flushed = false;

  function setState(s: PlaybackState) {
    state = s;
    opts.onStateChange?.(s);
  }

  async function processQueue() {
    if (stopped || queue.length === 0 || state === "playing" || state === "fetching") return;

    const entry = queue.shift()!;
    setState("fetching");
    opts.onSentenceStart?.(entry.text);

    const player = createAzureTTSPlayer({
      onDone: () => {
        currentPlayer = null;
        setState("idle");
        if (queue.length > 0) {
          processQueue();
        } else if (flushed) {
          opts.onDone?.();
        }
      },
    });
    currentPlayer = player;
    setState("playing");

    try {
      await player.synthAndPlay(buildTTSSSML(entry.text, voice));
    } catch {
      currentPlayer = null;
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
      currentPlayer?.stop();
      currentPlayer = null;
      queue.length = 0;
      buffer = "";
      setState("idle");
    },
  };
}
