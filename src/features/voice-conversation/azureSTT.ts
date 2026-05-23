"use client";

type SpeechSDK = typeof import("microsoft-cognitiveservices-speech-sdk");

// ─── Module-level caches ───────────────────────────────────────────────────

let _sdk: SpeechSDK | null = null;
export async function getSpeechSDK(): Promise<SpeechSDK> {
  if (!_sdk) _sdk = await import("microsoft-cognitiveservices-speech-sdk");
  return _sdk;
}

interface TokenData { token: string; region: string; expiresAt: number }
let _token: TokenData | null = null;
let _tokenInflight: Promise<TokenData> | null = null;

export async function getAzureToken(): Promise<{ token: string; region: string }> {
  if (_token && Date.now() < _token.expiresAt) return _token;
  if (_tokenInflight) return _tokenInflight;

  _tokenInflight = fetch("/api/azure-speech/token", { method: "POST" })
    .then((r) => {
      if (!r.ok) throw new Error(`Token request failed: ${r.status}`);
      return r.json() as Promise<TokenData>;
    })
    .then((data) => {
      _token = data;
      _tokenInflight = null;
      // Schedule a refresh 30s before expiry
      const refreshIn = data.expiresAt - Date.now() - 30_000;
      if (refreshIn > 0) setTimeout(() => { _token = null; }, refreshIn);
      return data;
    })
    .catch((err) => {
      _tokenInflight = null;
      throw err;
    });

  return _tokenInflight;
}

/** Pre-load the SDK bundle + mint the first token. Call on voice-mode mount. */
export function prewarmAzureSpeech(): void {
  getSpeechSDK().catch(() => {});
  getAzureToken().catch(() => {});
}

// ─── STT capture ──────────────────────────────────────────────────────────

export interface AzureSTTCapture {
  start(): void;
  stop(): void;
  abort(): void;
  readonly isSupported: boolean;
}

export function createAzureSTT(opts: {
  onInterim: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
  phraseHints?: string[];
}): AzureSTTCapture {
  let recognizer: InstanceType<SpeechSDK["SpeechRecognizer"]> | null = null;
  let aborted = false;

  return {
    isSupported: typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia,

    start() {
      if (aborted) return;

      (async () => {
        try {
          const [SDK, { token, region }] = await Promise.all([
            getSpeechSDK(),
            getAzureToken(),
          ]);
          if (aborted) return;

          const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region);
          speechConfig.speechRecognitionLanguage = "en-US";
          // End utterance after 300ms silence (Azure default ~500ms)
          speechConfig.setProperty(
            SDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
            "300",
          );
          // Stay alive in silence for 15s before timing out the session
          speechConfig.setProperty(
            SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
            "15000",
          );

          const audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput();
          const rec = new SDK.SpeechRecognizer(speechConfig, audioConfig);
          recognizer = rec;

          if (opts.phraseHints?.length) {
            const pl = SDK.PhraseListGrammar.fromRecognizer(rec);
            opts.phraseHints.forEach((p) => pl.addPhrase(p));
          }

          rec.recognizing = (_, e) => {
            if (e.result.text) opts.onInterim(e.result.text);
          };

          rec.recognized = (_, e) => {
            if (
              e.result.reason === SDK.ResultReason.RecognizedSpeech &&
              e.result.text
            ) {
              opts.onFinal(e.result.text);
            }
          };

          rec.canceled = (_, e) => {
            if (e.reason === SDK.CancellationReason.Error) {
              opts.onError(e.errorDetails ?? "Azure STT error");
            }
            opts.onEnd?.();
          };

          rec.sessionStopped = () => {
            opts.onEnd?.();
          };

          rec.startContinuousRecognitionAsync(
            () => {},
            (err) => opts.onError(String(err)),
          );
        } catch (err) {
          opts.onError(err instanceof Error ? err.message : "STT init failed");
        }
      })();
    },

    stop() {
      if (!recognizer) return;
      const rec = recognizer;
      recognizer = null;
      rec.stopContinuousRecognitionAsync(
        () => rec.close(),
        () => { try { rec.close(); } catch {} },
      );
    },

    abort() {
      aborted = true;
      if (recognizer) {
        const rec = recognizer;
        recognizer = null;
        try { rec.close(); } catch {}
      }
    },
  };
}

export function isAzureSTTSupported(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}
