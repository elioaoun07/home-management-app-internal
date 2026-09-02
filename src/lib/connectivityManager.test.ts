import { afterEach, describe, expect, it, vi } from "vitest";
import { probeNow } from "./connectivityManager";

describe("probeNow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one health request across concurrent timeout probes", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: true });

    const first = probeNow();
    const second = probeNow();

    expect(fetchMock).toHaveBeenCalledOnce();
    resolveFetch?.(new Response(null, { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
  });
});
