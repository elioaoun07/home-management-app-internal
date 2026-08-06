import { QueryClient, QueryObserver } from "@tanstack/query-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tripDocumentsQueryOptions } from "./documentQueries";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tripDocumentsQueryOptions", () => {
  it("revalidates a bundle-primed empty cache when the Docs tab mounts", async () => {
    const document = {
      id: "doc-1",
      user_id: "owner-1",
      trip_id: "trip-1",
      title: "Passport",
      doc_type: "passport" as const,
      storage_path: "owner-1/trip-1/doc-1.pdf",
      expires_on: null,
      notes: null,
      position: 0,
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [document],
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient();
    const options = tripDocumentsQueryOptions("trip-1");
    client.setQueryData(options.queryKey, []);

    const observer = new QueryObserver(client, options);
    const result = await new Promise<unknown[]>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("documents did not revalidate")), 1_000);
      const unsubscribe = observer.subscribe((state) => {
        if (state.data?.length) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(state.data);
        }
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/trips/trip-1/documents");
    expect(result).toEqual([document]);
  });
});
