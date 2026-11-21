export type StageTone =
  | "read"
  | "edit"
  | "command"
  | "check"
  | "message"
  | "event"
  | "failure"
  | "seal"
  | "ready"
  | "stale";

const rowPitch: Record<string, number> = {
  read: 520,
  edit: 660,
  command: 390,
  check: 780,
  message: 440,
  event: 480,
};

export interface StageSound {
  roomOutput: AudioDestinationNode;
  play: (kind: StageTone | string) => void;
  resume: () => Promise<void>;
  close: () => void;
  ambience: (vitality: number, tier: number, muted?: boolean) => void;
}

/** Construct only from a user gesture. A rolling window caps all note voices. */
export function createStageSound(): StageSound | null {
  if (typeof window.AudioContext !== "function") return null;
  const context = new AudioContext();
  const output = context.createGain();
  output.gain.setValueAtTime(1, context.currentTime);
  output.connect(context.destination);
  const voices: number[] = [];
  let bed: {
    filter: BiquadFilterNode;
    gains: GainNode[];
    oscillators: OscillatorNode[];
  } | null = null;
  const ambience = (vitality: number, tier: number, muted = false) => {
    output.gain.setValueAtTime(muted ? 0 : 1, context.currentTime);
    while (voices.length && voices[0] <= context.currentTime - 1)
      voices.shift();
    if (!bed && voices.length > 4) return;
    if (!bed && !muted && typeof context.createBiquadFilter === "function") {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.6;
      filter.connect(output);
      const gains: GainNode[] = [],
        oscillators: OscillatorNode[] = [];
      for (const frequency of [55, 110, 165, 220]) {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start();
        gains.push(gain);
        oscillators.push(oscillator);
        voices.push(context.currentTime);
      }
      bed = { filter, gains, oscillators };
    }
    if (!bed) return;
    const at = context.currentTime;
    bed.filter.frequency.setTargetAtTime(180 + vitality * 1200, at, 0.4);
    bed.gains.forEach((gain, i) =>
      gain.gain.setTargetAtTime(
        !muted && i <= tier ? (0.0035 * vitality) / (i + 1) : 0,
        at,
        0.12,
      ),
    );
  };
  const note = (
    frequency: number,
    delay = 0,
    length = 0.07,
    falling = false,
  ) => {
    const at = context.currentTime + delay;
    while (voices.length && voices[0] <= at - 1) voices.shift();
    if (voices.length >= 8) return;
    voices.push(at);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, at);
    if (falling)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency / 2,
        at + length,
      );
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.028, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(at);
    oscillator.stop(at + length + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  };
  return {
    roomOutput: context.destination,
    play(kind) {
      if (context.state !== "running") return;
      if (kind === "seal") {
        note(176, 0, 0.08);
        note(660);
        note(880, 0.11, 0.12);
      } else if (kind === "ready") {
        note(520);
        note(660, 0.11);
        note(880, 0.22, 0.16);
      } else if (kind === "failure") note(110, 0, 0.5, true);
      else if (kind === "stale") note(560, 0, 0.5, true);
      else note(rowPitch[kind] || rowPitch.event);
    },
    resume: () => context.resume(),
    ambience,
    close: () => {
      bed?.oscillators.forEach((oscillator) => {
        oscillator.stop();
        oscillator.disconnect();
      });
      bed?.gains.forEach((gain) => gain.disconnect());
      bed?.filter.disconnect();
      bed = null;
      output.disconnect();
      void context.close().catch(() => {});
    },
  };
}
