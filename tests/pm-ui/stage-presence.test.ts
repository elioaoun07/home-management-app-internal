import { afterEach, describe, expect, it, vi } from "vitest";
import {
  presenceSymbol,
  presenceTitle,
} from "../../scripts/pm/app/tabPresence";
import { createStageSound } from "../../scripts/pm/app/stageSound";

afterEach(() => vi.unstubAllGlobals());

describe("Local stage presence", () => {
  it("uses the plan's tab symbols for every state", () => {
    for (const [state, symbol] of Object.entries({
      live: "●",
      thinking: "●",
      quiet: "○",
      stale: "▲",
      "signal-lost": "▲",
      "link-down": "▲",
      failed: "✕",
      cancelled: "■",
      "your-turn": "◆",
      "push-pending": "◆",
      shipped: "✓",
      reverted: "↩",
    }))
      expect(presenceSymbol(state)).toBe(symbol);
    expect(presenceTitle("HUB-118", "failed")).toBe("✕ HUB-118");
  });

  it("caps every synthesized voice at eight per rolling second", () => {
    let time = 0;
    const starts: number[] = [];
    const frequencies: number[] = [];
    class Context {
      state = "running";
      destination = {};
      get currentTime() {
        return time;
      }
      resume = async () => {};
      close = async () => {};
      createGain = () => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      createOscillator = () => ({
        type: "sine",
        frequency: {
          setValueAtTime: (frequency: number) => frequencies.push(frequency),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: (at: number) => starts.push(at),
        stop: vi.fn(),
        onended: null,
      });
    }
    vi.stubGlobal("window", { AudioContext: Context });
    vi.stubGlobal("AudioContext", Context);
    const sound = createStageSound()!;
    for (let i = 0; i < 12; i++) sound.play("edit");
    expect(starts).toHaveLength(8);
    expect(new Set(frequencies)).toEqual(new Set([660]));
    time = 1.01;
    sound.play("seal");
    expect(starts).toHaveLength(11);
    expect(frequencies.slice(-3)).toEqual([176, 660, 880]);
    sound.close();
  });

  it("degrades without Web Audio support", () => {
    vi.stubGlobal("window", {});
    expect(createStageSound()).toBeNull();
  });

  it("immediately silences existing notes even when the voice window is full", () => {
    const gainNode = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    const gains: ReturnType<typeof gainNode>[] = [];
    class Context {
      state = "running";
      currentTime = 2;
      destination = {};
      resume = async () => {};
      close = async () => {};
      createGain() {
        const node = gainNode();
        gains.push(node);
        return node;
      }
      createOscillator = () => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      });
    }
    vi.stubGlobal("window", { AudioContext: Context });
    vi.stubGlobal("AudioContext", Context);
    const sound = createStageSound()!;
    sound.play("failure");
    for (let i = 0; i < 10; i++) sound.play("edit");
    const master = gains[0];
    expect(
      gains
        .slice(1)
        .every((gain) => gain.connect.mock.calls[0]?.[0] === master),
    ).toBe(true);
    sound.ambience(0, 0, true);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 2);
    sound.ambience(1, 0, false);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 2);
    sound.close();
  });
});
