// HUB-78 outcome contract + HUB-37 recoverable capture.
import { describe, expect, it } from "vitest";
import { deriveOutcome, tierFor } from "./engine";
import { resolveDraftTransaction } from "./intents/resolvers/budget";
import type { Intent } from "./types";
import type { EraBudgetSubmitResult } from "./useEraBudgetSubmit";

const draft: Intent = { kind: "draftTransaction", face: "budget", amount: 12, description: "x", rawText: "spent 12$ on coffee" };

describe("deriveOutcome", () => {
  it("maps each resolver shape to exactly one outcome", () => {
    expect(deriveOutcome(draft, { metadata: { draftId: "d1" } })).toMatchObject({ status: "drafted", inverse: "draft.delete", entityIds: ["d1"] });
    expect(deriveOutcome(draft, { ok: false, metadata: { uncertain: true } }).status).toBe("uncertain");
    expect(deriveOutcome(draft, { ok: false }).status).toBe("failed");
    expect(deriveOutcome(draft, { navigate: "/trips" }).status).toBe("handed_off");
    const reschedule: Intent = { kind: "reminderReschedule", face: "schedule", itemId: "i1", title: "Dentist", whenText: "5", rawText: "" };
    expect(deriveOutcome(reschedule, { metadata: { itemId: "i1", previousDueAt: "2026-09-28T09:00:00Z" } })).toMatchObject({
      status: "done",
      inverse: "reminder.patchDue",
    });
  });

  it("money movement never drops below Confirm", () => {
    expect(tierFor("transfer.create")).toBe("confirm");
    expect(tierFor("transaction.draft")).toBe("act");
    expect(tierFor("transaction.draft", true)).toBe("confirm");
    expect(tierFor("transfer.create", true)).toBe("confirm");
  });
});

describe("HUB-37 recoverable capture", () => {
  const submitWith = (r: EraBudgetSubmitResult) => async () => r;

  it("offline before sending is retryable (the bar keeps the text)", async () => {
    const r = await resolveDraftTransaction("spent 12$ on coffee", submitWith({ ok: false, reason: "offline", message: "offline" }));
    expect(r.metadata).toMatchObject({ retryable: true });
    expect(r.metadata?.uncertain).toBeUndefined();
  });

  it("a timeout after sending is uncertain and never retryable", async () => {
    const r = await resolveDraftTransaction("spent 12$ on coffee", submitWith({ ok: false, reason: "uncertain", message: "Not sure it saved. Check Drafts." }));
    expect(r.metadata).toMatchObject({ uncertain: true });
    expect(r.metadata?.retryable).toBeUndefined();
    expect(r.text).toMatch(/not sure/i);
    expect(deriveOutcome(draft, r).status).toBe("uncertain");
  });
});
