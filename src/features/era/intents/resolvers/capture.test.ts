import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "@/lib/safeFetch";
import { prepareItemCreate } from "@/lib/items/createContract";
import { localToISO } from "@/lib/utils/date";
import { resolveScheduleCapture } from "./capture";
import { resolveAddShopping } from "./shopping";
import { captureIntent, type ScheduleCapture } from "../../capture";
import { resolveIntent } from "../resolveIntent";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
const ITEM = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.mocked(safeFetch).mockReset();
  vi.mocked(safeFetch).mockResolvedValue(
    Response.json({ item: { id: ITEM }, completion: { status: "complete" } }),
  );
});
const reminder: ScheduleCapture = {
  kind: "reminder",
  title: "Call mom",
  date: "2026-10-13",
  time: "17:00",
  priority: "high",
  location: "Home",
  alert: "15",
};
describe("native structured source adapters", () => {
  it("saves the edited title, wall-clock date, priority, place and alert with an artifact and inverse", async () => {
    const result = await resolveIntent(
      captureIntent(reminder, "I paid for event $5"),
    );
    const body = JSON.parse(
      String(vi.mocked(safeFetch).mock.calls[0][1]?.body),
    );
    expect(body).toMatchObject({
      title: "Call mom",
      type: "reminder",
      priority: "high",
      location_text: "Home",
      due_at: localToISO(reminder.date, reminder.time),
    });
    expect(body.alerts[0].trigger_at).toBe(
      new Date(Date.parse(body.due_at) - 15 * 60_000).toISOString(),
    );
    expect(result.artifacts?.[0]).toMatchObject({
      entity: "reminder",
      id: ITEM,
    });
    vi.mocked(safeFetch).mockResolvedValue(Response.json({}));
    expect(await result.undo?.()).toBe(true);
    expect(safeFetch).toHaveBeenLastCalledWith(
      `/api/items/${ITEM}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  it("honors No alert through both client and server preparation", async () => {
    await resolveScheduleCapture({ ...reminder, alert: "none" });
    const body = JSON.parse(
      String(vi.mocked(safeFetch).mock.calls[0][1]?.body),
    );
    expect(prepareItemCreate(body).alerts).toEqual([]);
    expect(
      prepareItemCreate({
        type: "reminder",
        title: "Legacy",
        due_at: body.due_at,
      }).alerts,
    ).toHaveLength(1);
  });
  it("uses explicit event end and avoids post-save location questions", async () => {
    const result = await resolveIntent(
      captureIntent(
        { ...reminder, kind: "event", endDate: "2026-10-13", endTime: "19:00" },
        "Add an event",
      ),
    );
    const body = JSON.parse(
      String(vi.mocked(safeFetch).mock.calls[0][1]?.body),
    );
    expect(body).toMatchObject({
      type: "event",
      start_at: localToISO("2026-10-13", "17:00"),
      end_at: localToISO("2026-10-13", "19:00"),
    });
    expect(result.pending).toBeUndefined();
    expect(result.artifacts?.[0].entity).toBe("event");
  });
  it("refuses an inverted event without sending", async () => {
    expect(
      await resolveScheduleCapture({
        ...reminder,
        kind: "event",
        endDate: "2026-10-13",
        endTime: "16:00",
      }),
    ).toMatchObject({ ok: false });
    expect(safeFetch).not.toHaveBeenCalled();
  });
  it("never calls a parent-only receipt complete", async () => {
    vi.mocked(safeFetch).mockResolvedValue(
      Response.json({ item: { id: "item" } }),
    );
    const result = await resolveScheduleCapture(reminder);
    expect(result).toMatchObject({
      ok: false,
      metadata: { completion: "unknown" },
    });
    expect(result.undo).toBeUndefined();
  });
  it("sends each line to the selected list and group, with an inverse for acknowledged rows", async () => {
    let seq = 0;
    vi.mocked(safeFetch).mockImplementation(async (url) => {
      if (String(url) === "/api/hub/threads")
        return Response.json({
          threads: [
            { id: "first", purpose: "shopping" },
            { id: "chosen", purpose: "shopping" },
          ],
        });
      if (String(url).includes("shopping-groups?"))
        return Response.json({ groups: [{ id: "group", name: "Market" }] });
      return Response.json({ message: { id: `row-${++seq}` } });
    });
    const result = await resolveAddShopping(
      ["Milk", "Mac and cheese"],
      undefined,
      undefined,
      undefined,
      { threadId: "chosen", groupId: "group" },
    );
    const writes = vi
      .mocked(safeFetch)
      .mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { content: "Milk", thread_id: "chosen", shopping_group_id: "group" },
      {
        content: "Mac and cheese",
        thread_id: "chosen",
        shopping_group_id: "group",
      },
    ]);
    expect(result.artifacts).toHaveLength(2);
    await result.undo?.();
    expect(safeFetch).toHaveBeenLastCalledWith(
      "/api/hub/messages",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ messageIds: ["row-1", "row-2"] }),
      }),
    );
  });
  it.each(["foreign", "archived"])(
    "refuses an unavailable %s list before writing",
    async (id) => {
      vi.mocked(safeFetch).mockResolvedValue(
        Response.json({
          threads: [{ id: "archived", purpose: "shopping", is_archived: true }],
        }),
      );
      expect(
        await resolveAddShopping(["Milk"], undefined, undefined, undefined, {
          threadId: id,
          groupId: null,
        }),
      ).toMatchObject({ ok: false });
      expect(
        vi.mocked(safeFetch).mock.calls.every(([, init]) => !init?.method),
      ).toBe(true);
    },
  );
  it("refuses a stale group before writing", async () => {
    vi.mocked(safeFetch).mockImplementation(async (url) =>
      Response.json(
        String(url) === "/api/hub/threads"
          ? { threads: [{ id: "chosen", purpose: "shopping" }] }
          : { groups: [] },
      ),
    );
    expect(
      await resolveAddShopping(["Milk"], undefined, undefined, undefined, {
        threadId: "chosen",
        groupId: "deleted",
      }),
    ).toMatchObject({ ok: false });
    expect(
      vi.mocked(safeFetch).mock.calls.every(([, init]) => !init?.method),
    ).toBe(true);
  });
});
