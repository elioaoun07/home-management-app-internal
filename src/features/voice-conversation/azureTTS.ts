"use client";

import { getAudioContext } from "./audioContext";
import { getSpeechSDK, getAzureToken } from "./azureSTT";

export { getAzureToken };

export const DEFAULT_TTS_VOICE_SDK = "en-US-AvaMultilingualNeural";

// ─── AudioWorklet loader ───────────────────────────────────────────────────

let _workletLoaded = false;
let _workletLoading: Promise<void> | null = null;

async function ensureWorklet(): Promise<void> {
  if (_workletLoaded) return;
  if (_workletLoading) return _workletLoading;

  _workletLoading = (async () => {
    const ac = getAudioContext();
    if (ac.state === "suspended") await ac.resume();
    await ac.audioWorklet.addModule("/voice/pcm-player.worklet.js");
    _workletLoaded = true;
    _workletLoading = null;
  })();

  return _workletLoading;
}

/** Pre-load the worklet module so first synthesis starts without a round-trip. */
export function prewarmTTSWorklet(): void {
  ensureWorklet().catch(() => {});
}

// ─── PCM TTS player ───────────────────────────────────────────────────────

export interface AzureTTSPlayer {
  /** Synthesize SSML and stream audio into the worklet. Resolves when audio drains. */
  synthAndPlay(ssml: string): Promise<void>;
  /** Kill playback immediately (barge-in). */
  stop(): void;
}

export function createAzureTTSPlayer(opts: { onDone?(): void }): AzureTTSPlayer {
  let workletNode: AudioWorkletNode | null = null;
  let stopped = false;

  return {
    async synthAndPlay(ssml: string) {
      if (stopped) return;

      const [SDK, { token, region }] = await Promise.all([
        getSpeechSDK(),
        getAzureToken(),
      ]);
      if (stopped) return;

      await ensureWorklet();
      if (stopped) return;

      const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = DEFAULT_TTS_VOICE_SDK;
      speechConfig.speechSynthesisOutputFormat =
        SDK.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm;

      // No AudioConfig → PCM chunks arrive via synthesizing event, no auto-playback
      const synth = new SDK.SpeechSynthesizer(speechConfig);

      const ac = getAudioContext();
      if (ac.state === "suspended") await ac.resume();

      const node = new AudioWorkletNode(ac, "era-pcm-player", {
        outputChannelCount: [1],
        processorOptions: { sourceSampleRate: 24000 },
      });
      node.connect(ac.destination);
      workletNode = node;

      synth.synthesizing = (_, event) => {
        if (stopped) return;
        if (event.result.reason === SDK.ResultReason.SynthesizingAudio) {
          const pcm = event.result.audioData;
          if (pcm && pcm.byteLength > 0) {
            node.port.postMessage({ type: "pcm", buffer: pcm }, [pcm]);
          }
        }
      };

      await new Promise<void>((resolve, reject) => {
        node.port.onmessage = (e) => {
          if (e.data.type === "done") {
            opts.onDone?.();
            resolve();
          }
        };

        synth.speakSsmlAsync(
          ssml,
          () => {
            if (stopped) {
              resolve();
              try { synth.close(); } catch {}
              return;
            }
            node.port.postMessage({ type: "end" });
            try { synth.close(); } catch {}
          },
          (err) => {
            try { synth.close(); } catch {}
            reject(new Error(String(err)));
          },
        );
      });

      workletNode = null;
    },

    stop() {
      stopped = true;
      if (workletNode) {
        workletNode.port.postMessage({ type: "stop" });
        workletNode.disconnect();
        workletNode = null;
      }
    },
  };
}
