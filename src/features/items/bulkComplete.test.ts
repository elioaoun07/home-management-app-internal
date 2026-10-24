import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemWithDetails } from "@/types/items";

const mock = vi.hoisted(() => ({
  online: vi.fn(() => true),
  safeFetch: vi.fn(),
  addToQueue: vi.fn(async (_op: Record<string, unknown>) => "op-1"),
  processQueue: vi.fn(),
}));
vi.mock("@/lib/connectivityManager", () => ({ isReallyOnline: mock.online }));
vi.mock("@/lib/safeFetch", async (original) => ({
  ...(await original<typeof import("@/lib/safeFetch")>()),
  safeFetch: mock.safeFetch,
}));
vi.mock("@/lib/offlineQueue", () => ({
  addToQueue: mock.addToQueue,
  removeQueuedItemCreates: vi.fn(async () => []),
}));
vi.mock("@/lib/offlineSyncEngine", () => ({ getSyncEngine: () => ({ processQueue: mock.processQueue }) }));
// The real module opens a browser Supabase client; only the key factory is needed here
vi.mock("./useItems", () => {
  const all = ["items"] as const;
  const lists = () => [...all, "list"] as const;
  return {
    itemsKeys: {
      all, lists,
      list: (filters: object) => [...lists(), filters] as const,
      reminders: () => [...all, "reminders"] as const,
      tasks: () => [...all, "tasks"] as const,
      events: () => [...all, "events"] as const,
      allActions: () => [...all, "all-actions"] as const,
    },
  };
});

import { OfflineError } from "@/lib/safeFetch";
import { completeItemsBulk, uncompleteItemsBulk } from "./bulkComplete";
import type { ItemOccurrenceAction } from "./useItemActions";
import { itemsKeys } from "./useItems";

const NOW = "2026-10-20T09:00:00.000Z";
const noSleep = vi.fn(async () => {});
const room = (n: number) =>
  ({
    id: `item-${n}`, type: "reminder", title: `Sweep floor · Room ${n}`, status: "pending",
    is_chore: true, reminder_details: { item_id: `item-${n}`, due_at: NOW, completed_at: null },
  }) as unknown as ItemWithDetails;
const routine = {
  id: "routine", type: "task", title: "Water plants", status: "pending",
  recurrence_rule: { rrule: "", is_flexible: true },
} as unknown as ItemWithDetails;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** A server that answers each entry with `ok` unless its index is listed */
const answers = (refused: number[] = []) => async (_url: string, init: RequestInit) => {
  const sent = JSON.parse(String(init.body)).entries as { item_id: string }[];
  return json({ results: sent.map((e, i) => ({ item_id: e.item_id, ok: !refused.includes(i) })) });
};
const agenda = (qc: QueryClient) => qc.getQueryData<ItemWithDetails[]>(itemsKeys.list({})) ?? [];
const actions = (qc: QueryClient) => qc.getQueryData<ItemOccurrenceAction[]>(itemsKeys.allActions()) ?? [];
const targets = (items: ItemWithDetails[]) =>
  items.map((item) => ({ item, occurrenceDate: NOW, plannedFor: "2026-10-20T10:00:00.000Z" }));
let qc: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  mock.online.mockReturnValue(true);
  mock.addToQueue.mockResolvedValue("op-1");
  qc = new QueryClient();
  qc.setQueryData(itemsKeys.list({}), [room(1), room(2), room(3), routine]);
  qc.setQueryData(itemsKeys.allActions(), []);
});

describe("completeItemsBulk", () => {
  it("completes every room in one request and shows them done", async () => {
    mock.safeFetch.mockImplementation(answers());
    const result = await completeItemsBulk(qc, targets([room(1), room(2), room(3), routine]), { sleep: noSleep });

    expect(mock.safeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mock.safeFetch.mock.calls[0];
    expect(url).toBe("/api/items/bulk/complete");
    const sent = JSON.parse(String(init.body)).entries;
    expect(sent.map((e: { is_recurring: boolean }) => e.is_recurring)).toEqual([false, false, false, true]);
    expect(sent[0].planned_for).toBe("2026-10-20T10:00:00.000Z");
    expect(result.done).toHaveLength(4);
    expect(agenda(qc).filter((i) => i.status === "completed").map((i) => i.id)).toEqual(["item-1", "item-2", "item-3"]);
    expect(actions(qc)).toHaveLength(4);
  });

  it("reopens only what the server refused", async () => {
    mock.safeFetch.mockImplementation(answers([1]));
    const result = await completeItemsBulk(qc, targets([room(1), room(2)]), { sleep: noSleep });

    expect(result.refused.map((e) => e.item_id)).toEqual(["item-2"]);
    expect(agenda(qc).find((i) => i.id === "item-2")?.status).toBe("pending");
    expect(agenda(qc).find((i) => i.id === "item-1")?.status).toBe("completed");
  });

  it("queues one operation when the network is gone and keeps them done", async () => {
    mock.safeFetch.mockRejectedValue(new OfflineError());
    const result = await completeItemsBulk(qc, targets([room(1), room(2)]), { sleep: noSleep });

    expect(result.queued).toHaveLength(2);
    expect(mock.addToQueue).toHaveBeenCalledTimes(1);
    expect(mock.addToQueue.mock.calls[0][0]).toMatchObject({
      endpoint: "/api/items/bulk/complete", method: "POST", operation: "complete",
    });
    expect(agenda(qc).filter((i) => i.status === "completed")).toHaveLength(2);
  });

  it("retries a slow request before queueing, with the same body", async () => {
    mock.safeFetch
      .mockResolvedValueOnce(json({}, 503))
      .mockImplementationOnce(answers());
    const result = await completeItemsBulk(qc, targets([room(1)]), { sleep: noSleep });

    expect(mock.safeFetch).toHaveBeenCalledTimes(2);
    expect(mock.safeFetch.mock.calls[0][1].body).toBe(mock.safeFetch.mock.calls[1][1].body);
    expect(result.done).toHaveLength(1);
  });
});

describe("a single chore slot (Done / Reopen)", () => {
  it("shows done before the request has answered", async () => {
    let answer: (r: Response) => void = () => {};
    mock.safeFetch.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)));
    const pending = completeItemsBulk(qc, targets([room(1)]), { sleep: noSleep });
    await vi.waitFor(() => expect(agenda(qc).find((i) => i.id === "item-1")?.status).toBe("completed"));
    expect(mock.safeFetch).toHaveBeenCalledTimes(1);

    answer(json({ results: [{ item_id: "item-1", ok: true }] }));
    expect((await pending).done).toHaveLength(1);
  });

  it("reopens a routine slot whose stored action carries a different timestamp format", async () => {
    mock.safeFetch.mockImplementation(answers());
    qc.setQueryData(itemsKeys.allActions(), [
      {
        id: "a1", item_id: "routine", action_type: "completed",
        occurrence_date: "2026-10-20T09:00:00+00:00", created_at: NOW,
      },
    ]);
    const { ok } = await uncompleteItemsBulk(
      qc,
      [{ item_id: "routine", occurrence_date: "2026-10-20T09:00:00+00:00", is_recurring: true }],
      { sleep: noSleep },
    );
    expect(ok).toBe(true);
    expect(actions(qc)).toHaveLength(0);
    expect(JSON.parse(String(mock.safeFetch.mock.calls[0][1].body)).entries[0]).toEqual({
      item_id: "routine", occurrence_date: "2026-10-20T09:00:00+00:00", is_recurring: true,
    });
  });

  it("an offline Done stays done and waits in the queue", async () => {
    mock.safeFetch.mockRejectedValue(new OfflineError());
    const { queued } = await completeItemsBulk(qc, targets([routine]), { sleep: noSleep });
    expect(queued).toHaveLength(1);
    expect(mock.addToQueue).toHaveBeenCalledTimes(1);
    expect(actions(qc)).toHaveLength(1);
  });
});

describe("uncompleteItemsBulk", () => {
  it("reopens them at once with one DELETE", async () => {
    mock.safeFetch.mockImplementation(answers());
    const { done } = await completeItemsBulk(qc, targets([room(1), routine]), { sleep: noSleep });
    mock.safeFetch.mockClear();

    const { ok } = await uncompleteItemsBulk(qc, done, { sleep: noSleep });

    expect(ok).toBe(true);
    expect(mock.safeFetch).toHaveBeenCalledTimes(1);
    expect(mock.safeFetch.mock.calls[0][1].method).toBe("DELETE");
    expect(agenda(qc).find((i) => i.id === "item-1")?.status).toBe("pending");
    expect(actions(qc)).toHaveLength(0);
  });
});
