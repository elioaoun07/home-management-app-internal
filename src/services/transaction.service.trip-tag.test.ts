import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseTransactionService } from "./transaction.service";

const USER_ID = "user-1";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const mockState = vi.hoisted(() => ({
  /** Trips this user may tag with. */
  accessibleTrips: [] as string[],
  /** Payload of each `.update()` on `transactions`, in call order. */
  updatePayloads: [] as Array<Record<string, unknown>>,
  /** Payload of each `.insert()` on `transactions`, in call order. */
  insertPayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/tripAccess", () => ({
  canAccessTrip: vi.fn(
    async (_s: unknown, _u: string, tripId: string) =>
      mockState.accessibleTrips.includes(tripId),
  ),
}));

vi.mock("@/lib/accountAccess", () => ({
  getAccessibleAccount: vi.fn(async () => ({
    id: ACCOUNT_ID,
    user_id: USER_ID,
    name: "Debit Card - NEO",
    type: "expense",
    canWrite: true,
  })),
}));

const adjustAccountBalance = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/balance", () => ({ adjustAccountBalance }));

function createSupabaseStub() {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    Object.assign(chain, {
      select: self,
      eq: self,
      in: self,
      is: self,
      or: self,
      order: self,
      limit: self,
      update(payload: Record<string, unknown>) {
        if (table === "transactions") mockState.updatePayloads.push(payload);
        return chain;
      },
      insert(payload: Record<string, unknown>) {
        if (table === "transactions") mockState.insertPayloads.push(payload);
        return chain;
      },
      single: async () => ({
        data:
          table === "transactions"
            ? { id: "tx-1", account_id: ACCOUNT_ID, amount: 120, is_draft: false }
            : { name: "Travel", color: "#38bdf8" },
        error: null,
      }),
      maybeSingle: async () => ({ data: null, error: null }),
    });
    return chain;
  };

  return {
    from,
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
  } as never;
}

function service() {
  return new SupabaseTransactionService(createSupabaseStub());
}

beforeEach(() => {
  mockState.accessibleTrips = [TRIP_ID];
  mockState.updatePayloads = [];
  mockState.insertPayloads = [];
  adjustAccountBalance.mockClear();
});

describe("trip tagging — update", () => {
  it("writes trip_id and touches nothing else", async () => {
    await service().updateTransaction(USER_ID, { id: "tx-1", trip_id: TRIP_ID });

    expect(mockState.updatePayloads).toHaveLength(1);
    // Exactly one field changes: the tag. Not the account, not the amount.
    expect(mockState.updatePayloads[0]).toEqual({ trip_id: TRIP_ID });
  });

  it("never moves money — tagging is not a balance event", async () => {
    await service().updateTransaction(USER_ID, { id: "tx-1", trip_id: TRIP_ID });
    expect(adjustAccountBalance).not.toHaveBeenCalled();
  });

  it("untags on null and on empty string", async () => {
    await service().updateTransaction(USER_ID, { id: "tx-1", trip_id: null });
    await service().updateTransaction(USER_ID, { id: "tx-1", trip_id: "" });

    expect(mockState.updatePayloads).toEqual([
      { trip_id: null },
      { trip_id: null },
    ]);
  });

  it("rejects a trip the user cannot see, without writing", async () => {
    mockState.accessibleTrips = [];

    await expect(
      service().updateTransaction(USER_ID, { id: "tx-1", trip_id: TRIP_ID }),
    ).rejects.toThrow("Invalid trip_id");
    expect(mockState.updatePayloads).toHaveLength(0);
  });

  it("leaves trip_id alone when the field is absent", async () => {
    await service().updateTransaction(USER_ID, { id: "tx-1", amount: 50 });

    expect(mockState.updatePayloads[0]).not.toHaveProperty("trip_id");
  });
});

describe("trip tagging — create", () => {
  const base = {
    account_id: ACCOUNT_ID,
    category_id: CATEGORY_ID,
    amount: 120,
  };

  it("stores the tag on insert", async () => {
    await service().createTransaction(USER_ID, { ...base, trip_id: TRIP_ID });

    expect(mockState.insertPayloads[0]).toMatchObject({
      trip_id: TRIP_ID,
      account_id: ACCOUNT_ID,
    });
  });

  it("defaults to null when untagged — existing behavior is unchanged", async () => {
    await service().createTransaction(USER_ID, base);

    expect(mockState.insertPayloads[0]).toMatchObject({ trip_id: null });
  });

  it("rejects a trip the user cannot see, without inserting", async () => {
    mockState.accessibleTrips = [];

    await expect(
      service().createTransaction(USER_ID, { ...base, trip_id: TRIP_ID }),
    ).rejects.toThrow("Invalid trip_id");
    expect(mockState.insertPayloads).toHaveLength(0);
  });
});
