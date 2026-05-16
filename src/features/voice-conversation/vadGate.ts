"use client";

export interface VADGate {
  start(): Promise<void>;
  stop(): void;
}

interface VADGateOptions {
  onSpeechStart: () => void;
  onSpeechEnd?: () => void;
  /**
   * RMS energy threshold (0–1). Lower = more sensitive to quiet speech.
   * Default 0.010 — captures normal conversation, rejects ambient room tone.
   */
  threshold?: number;
  /**
   * How many consecutive high-energy frames (~16ms each at 60fps) before
   * declaring speech started. Prevents false triggers from door slams/pops.
   * Default 5 (~80ms).
   */
  onsetFrames?: number;
  /** ms of silence after which onSpeechEnd fires. Default 600. */
  silenceMs?: number;
}

function rms(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const s = (data[i] - 128) / 128;
    sum += s * s;
  }
  return Math.sqrt(sum / data.length);
}

/**
 * Lightweight local VAD (Voice Activity Detector) using the Web Audio AnalyserNode.
 * Runs on the main thread via requestAnimationFrame (~60fps polling).
 * Fires onSpeechStart when sustained energy is detected — callers then arm STT
 * so a fresh SpeechRecognition instance processes the user's utterance.
 *
 * Keeps its own AudioContext for analysis (separate from TTS output context).
 */
export function createVADGate(opts: VADGateOptions): VADGate {
  let stopped = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId: number | null = null;
  let speaking = false;
  let onsetCount = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const THRESHOLD = opts.threshold ?? 0.010;
  const ONSET_FRAMES = opts.onsetFrames ?? 5;
  const SILENCE_MS = opts.silenceMs ?? 600;

  return {
    async start() {
      if (stopped || typeof window === "undefined") return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch {
        // Mic denied or unavailable — degrade gracefully, engine falls back to continuous STT
        return;
      }

      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        return;
      }

      audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      src.connect(analyser);

      const td = new Uint8Array(analyser.fftSize);

      function tick() {
        if (stopped) return;
        rafId = requestAnimationFrame(tick);
        analyser.getByteTimeDomainData(td);
        const energy = rms(td);

        if (energy > THRESHOLD) {
          if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
          if (!speaking) {
            onsetCount++;
            if (onsetCount >= ONSET_FRAMES) {
              speaking = true;
              onsetCount = 0;
              opts.onSpeechStart();
            }
          }
        } else {
          onsetCount = 0;
          if (speaking && !silenceTimer) {
            silenceTimer = setTimeout(() => {
              speaking = false;
              silenceTimer = null;
              opts.onSpeechEnd?.();
            }, SILENCE_MS);
          }
        }
      }

      tick();
    },

    stop() {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      audioCtx?.close().catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
    },
  };
}
