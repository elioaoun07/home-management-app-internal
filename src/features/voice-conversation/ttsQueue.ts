"use client";

type PlaybackState = "idle" | "fetching" | "playing";

interface QueueEntry {
  text: string;
  audioBlob?: Blob;
}

/**
 * Sentence-streaming TTS queue.
 * Splits incoming text on sentence boundaries, fetches MP3 from /api/tts per sentence,
 * and plays them sequentially — so audio starts well before the full response arrives.
 *
 * Usage:
 *   const q = createTTSQueue({ voice: "en-US-AvaMultilingualNeural", onStateChange });
 *   q.push("Hello!"); // can be called multiple times as chunks arrive
 *   q.flush();        // call when the full response has been pushed
 *   q.stop();         // immediate stop + clear queue
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
  const voice = opts.voice ?? "en-US-AvaMultilingualNeural";
  const queue: QueueEntry[] = [];
  let state: PlaybackState = "idle";
  let currentAudio: HTMLAudioElement | null = null;
  let stopped = false;
  let buffer = "";
  let flushed = false;

  function setState(s: PlaybackState) {
    state = s;
    opts.onStateChange?.(s);
  }

  function ssml(text: string): string {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}">${escaped}</voice></speak>`;
  }

  async function fetchAudio(text: string): Promise<Blob | null> {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssml: ssml(text) }),
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

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      setState("idle");
      if (queue.length > 0) {
        processQueue();
      } else if (flushed) {
        opts.onDone?.();
      }
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      setState("idle");
      processQueue();
    };

    try {
      await audio.play();
    } catch {
      setState("idle");
      processQueue();
    }
  }

  /** Extract complete sentences from the buffer. */
  function extractSentences(): string[] {
    const sentences: string[] = [];
    // Split on .!? followed by space or end — keep delimiter attached
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
    // Pre-fetch next while current is playing
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
      // Enqueue whatever remains in the buffer
      const remaining = buffer.trim();
      buffer = "";
      if (remaining) enqueue(remaining);
      if (queue.length === 0 && state === "idle") {
        opts.onDone?.();
      }
    },

    stop() {
      stopped = true;
      currentAudio?.pause();
      currentAudio = null;
      queue.length = 0;
      buffer = "";
      setState("idle");
    },
  };
}
