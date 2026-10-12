import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "@/lib/safeFetch";
import { resolveDraftReminder, resolvePendingReminderAnswer } from "./schedule";
vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(safeFetch).mockReset();
  vi.mocked(safeFetch).mockImplementation(async () =>
    Response.json({ item: { id: "11111111-1111-4111-8111-111111111111" }, completion: { status: "complete" } }),
  );
});
describe("recurring capture is never silently reduced to one reminder", () => {
  it("does not ask for a one-time date when only a recurring cadence was given", async () => {
    const result = await resolveDraftReminder("Water plants every day");
    expect(safeFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      pending: null,
      navigate: "/reminders",
    });
  });
  it("routes a parsed recurring request to Schedule without a write", async () => {
    const result = await resolveDraftReminder(
      "Remind me to water plants every Monday at 5pm",
      "Water plants",
      new Date(2026, 9, 11, 12),
    );
    expect(safeFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      navigate: "/reminders",
      metadata: { notDispatched: true },
    });
    expect(result.text).toContain("Schedule");
  });
  it("also protects a recurring answer to a pending date question", async () => {
    const result = await resolvePendingReminderAnswer(
      {
        kind: "draftReminder",
        title: "Water plants",
        priority: "normal",
        rawText: "Water plants",
        createdAt: Date.now(),
      },
      "every Monday at 5pm",
    );
    expect(safeFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, navigate: "/reminders" });
  });
  it("keeps an ordinary one-time reminder working", async () => {
    const result = await resolveDraftReminder(
      "Remind me to water plants tomorrow at 5pm",
      "Water plants",
      new Date(2026, 9, 11, 12),
    );
    expect(safeFetch).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toHaveLength(1);
  });
});
