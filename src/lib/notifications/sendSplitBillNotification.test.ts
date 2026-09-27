import { safeFetch } from "@/lib/safeFetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendSplitBillNotification } from "./sendSplitBillNotification";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));

describe("sendSplitBillNotification", () => {
  beforeEach(() => {
    vi.mocked(safeFetch).mockReset();
    vi.mocked(safeFetch).mockResolvedValue({ ok: true } as Response);
  });

  it("sends the total and editable partner suggestion with the push notification", async () => {
    await sendSplitBillNotification({
      transactionId: "split-1",
      collaboratorId: "partner-1",
      amount: 30,
      totalBillAmount: 70,
      categoryName: "Food",
    });

    const [, options] = vi.mocked(safeFetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.message).toContain("Total: $70.00");
    expect(body.action_data).toMatchObject({
      owner_amount: 30,
      total_bill_amount: 70,
      suggested_amount: 40,
    });
  });
});
