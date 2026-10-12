import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "@/lib/safeFetch";
import { localToISO } from "@/lib/utils/date";
import { findReminderCandidates } from "../intents/resolvers/reminderLookup";
import { ERA_CAPABILITIES } from "../capabilities/registry";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("../intents/resolvers/reminderLookup", () => ({
  findReminderCandidates: vi.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
const reference = new Date(2026, 9, 10, 12);
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});
afterEach(() => vi.useRealTimers());
describe("durable plans through real application adapters", () => {
  it("a resumed tomorrow meal retains the originating calendar date", async () => {
    vi.mocked(safeFetch).mockImplementation(async (url) => {
      if (String(url).startsWith("/api/recipes?"))
        return Response.json([{ id, name: "Chicken" }]);
      if (url === "/api/meal-plans") return Response.json({ id });
      throw new Error(`Unexpected ${url}`);
    });
    await ERA_CAPABILITIES["meal.assign"].execute(
      { dish: "Chicken", dayHint: "tomorrow", mealType: "dinner" },
      { referenceDate: reference },
    );
    const body = vi
      .mocked(safeFetch)
      .mock.calls.find(([url]) => url === "/api/meal-plans")?.[1]?.body;
    expect(JSON.parse(String(body))).toMatchObject({
      planned_date: "2026-10-11",
      meal_type: "dinner",
    });
  });
  it("a resumed reminder retains its original date and canonical UTC conversion", async () => {
    vi.mocked(safeFetch).mockResolvedValue(Response.json({ item: { id } }));
    await ERA_CAPABILITIES["reminder.create"].execute(
      {
        rawText: "remind me to collect milk tomorrow at 5pm",
        title: "Collect milk",
      },
      { referenceDate: reference },
    );
    const body = vi
      .mocked(safeFetch)
      .mock.calls.find(([url]) => url === "/api/items")?.[1]?.body;
    expect(JSON.parse(String(body))).toMatchObject({
      due_at: localToISO("2026-10-11", "17:00"),
      title: "Collect milk",
    });
  });
  it.each(["recurring", "partner", "removed"])(
    "a saved reminder that is now %s is rechecked before any write",
    async (change) => {
      vi.mocked(findReminderCandidates).mockResolvedValue(
        change === "removed"
          ? []
          : [
              {
                id,
                title: "Dentist",
                recurring: change === "recurring",
                mine: change !== "partner",
                dueAt: null,
              },
            ],
      );
      const result = await ERA_CAPABILITIES["reminder.reschedule"].execute(
        { itemId: id, title: "Dentist", whenText: "tomorrow" },
        { referenceDate: reference },
      );
      expect(result).toMatchObject({
        ok: false,
        metadata: { notDispatched: true },
      });
      expect(safeFetch).not.toHaveBeenCalled();
    },
  );
  it("failed item checkpoint stops the batch before another POST or group mutation", async () => {
    vi.mocked(safeFetch).mockImplementation(async (url) => {
      if (url === "/api/hub/threads")
        return Response.json({ threads: [{ id, purpose: "shopping" }] });
      if (String(url).startsWith("/api/hub/shopping-groups?"))
        return Response.json({ groups: [] });
      if (url === "/api/hub/messages")
        return Response.json({ message: { id } });
      throw new Error(`Unexpected ${url}`);
    });
    const onProgress = vi.fn().mockRejectedValue(new Error("Checkpoint lost"));
    const result = await ERA_CAPABILITIES["shopping.add"].execute(
      { items: ["Milk", "Eggs"], groupHint: "New group" },
      { referenceDate: reference, onProgress },
    );
    expect(
      vi
        .mocked(safeFetch)
        .mock.calls.filter(
          ([url, init]) =>
            url === "/api/hub/messages" && init?.method === "POST",
        ),
    ).toHaveLength(1);
    expect(result).toMatchObject({
      ok: false,
      metadata: { partial: true },
      artifacts: [{ id, title: "Milk" }],
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(result.proposal).toBeUndefined();
  });
});
