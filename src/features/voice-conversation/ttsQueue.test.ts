import { beforeEach, describe, expect, it, vi } from "vitest";

const azure = vi.hoisted(() => ({
  createAzureTTSPlayer: vi.fn(),
}));

vi.mock("./azureTTS", () => azure);

import { buildTTSSSML, createTTSQueue } from "./ttsQueue";

describe("createTTSQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams complete sentences in order", async () => {
    const synthesized: string[] = [];
    azure.createAzureTTSPlayer.mockImplementation(
      (options: { onDone?(): void }) => ({
        synthAndPlay: vi.fn(async (ssml: string) => {
          synthesized.push(ssml);
          options.onDone?.();
        }),
        stop: vi.fn(),
      }),
    );
    const onDone = vi.fn();
    const queue = createTTSQueue({ onDone });

    queue.push("First sentence. Second sentence?");
    queue.flush();

    await vi.waitFor(() => expect(synthesized).toHaveLength(2));
    expect(synthesized[0]).toContain("First sentence.");
    expect(synthesized[1]).toContain("Second sentence?");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("reports synthesis failure and finishes a flushed queue", async () => {
    azure.createAzureTTSPlayer.mockImplementation(() => ({
      synthAndPlay: vi.fn().mockRejectedValue(new Error("Azure unavailable")),
      stop: vi.fn(),
    }));
    const onError = vi.fn();
    const onDone = vi.fn();
    const queue = createTTSQueue({ onError, onDone });

    queue.push("Fallback please.");
    queue.flush();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onDone).toHaveBeenCalledOnce();
  });
});

describe("buildTTSSSML", () => {
  it("escapes user-visible reply text", () => {
    expect(buildTTSSSML('Spend < $20 & say "done".')).toContain(
      "Spend &lt; $20 &amp; say &quot;done&quot;.",
    );
  });
});
