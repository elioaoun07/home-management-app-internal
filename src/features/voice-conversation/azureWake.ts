"use client";

import { getSpeechSDK, getAzureToken } from "./azureSTT";

/**
 * Azure keyword recognition — replaces Porcupine wake word entirely.
 *
 * SETUP (one-time, ~3 minutes):
 *  1. Go to https://speech.microsoft.com → Custom Keyword
 *  2. Create a new keyword project named "Hey ERA"
 *  3. Record 3 sample pronunciations
 *  4. Download the generated model file (.table)
 *  5. Save it to: public/voice/hey-era.table
 *
 * After the model file is in place, set NEXT_PUBLIC_WAKE_MODEL_ENABLED=true
 * and the engine will automatically activate this recognizer.
 *
 * HOW IT WORKS: The Azure SDK's startKeywordRecognitionAsync() runs the model
 * locally via WebAssembly — no cloud round-trip until the keyword is confirmed.
 * On confirmation, it seamlessly upgrades to full cloud STT for the command.
 */

export interface AzureWake {
  start(): Promise<void>;
  stop(): void;
}

const MODEL_PATH = "/voice/hey-era.table";

export function createAzureWake(opts: { onWake(): void }): AzureWake {
  let stopped = false;
  let recognizer: any | null = null;

  return {
    async start() {
      if (stopped) return;

      try {
        const [SDK, { token, region }] = await Promise.all([
          getSpeechSDK(),
          getAzureToken(),
        ]);
        if (stopped) return;

        const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region);
        const audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput();

        const model = await SDK.KeywordRecognitionModel.fromFile(MODEL_PATH);
        if (stopped) return;

        const rec = new SDK.SpeechRecognizer(speechConfig, audioConfig);
        recognizer = rec;

        rec.recognized = (_: unknown, e: any) => {
          if (e.result.reason === SDK.ResultReason.RecognizedKeyword) {
            opts.onWake();
          }
        };

        // startKeywordRecognitionAsync is available in SDK v1.x+.
        // It runs locally on-device until keyword fires, then upgrades to cloud STT.
        (rec as any).startKeywordRecognitionAsync(
          model,
          () => {},
          () => { try { rec.close(); } catch {} },
        );
      } catch {
        // Model not found or SDK error — degrade silently; engine falls back to WAKE_PATTERN regex
      }
    },

    stop() {
      stopped = true;
      if (recognizer) {
        try {
          (recognizer as any).stopKeywordRecognitionAsync(() => {}, () => {});
          recognizer.close();
        } catch {}
        recognizer = null;
      }
    },
  };
}

/** True when the wake model file is expected to be present. */
export function isAzureWakeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WAKE_MODEL_ENABLED === "true";
}
