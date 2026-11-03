// BUD-87 regression: a slow create was resubmitted and inserted twice, and the
// balances it should have moved were not on screen. These pin the client half:
// one identical request per retry, optimistic balances that mirror the route.
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/safeFetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safeFetch")>()),
  safeFetch: vi.fn(),
}));

import { OfflineError, RequestTimeoutError, safeFetch } from "@/lib/safeFetch";
import {
  nextToAmount,
  optimisticTransfer,
  sendTransferWrite,
  shiftCachedBalances,
  transferMoves,
  TransferRefusedError,
  TransferUnconfirmedError,
} from "./hooks";

const fetchMock = vi.mocked(safeFetch);
const noSleep = () => Promise.resolve();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const ID = "7d1c6a52-6b0e-4a43-9a51-0d1d7a1e3c11";
const body = { id: ID, from_account_id: "wallet", to_account_id: "savings", amount: 20 };

// Block body: a returned function would be run by Vitest as teardown
beforeEach(() => {
  fetchMock.mockReset();
});

describe("sendTransferWrite", () => {
  it("retries a timed-out create with the identical body (same id)", async () => {
    fetchMock
      .mockRejectedValueOnce(new RequestTimeoutError(15_000))
      .mockResolvedValueOnce(json(200, { ...body, replayed: true }));

    await expect(
      sendTransferWrite("/api/transfers", { method: "POST", body }, "Transfer", noSleep),
    ).resolves.toMatchObject({ id: ID });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = fetchMock.mock.calls.map(([, init]) => init?.body);
    expect(sent[0]).toBe(JSON.stringify(body));
    expect(sent[1]).toBe(sent[0]);
  });

  it("treats a 5xx as unverified and retries it", async () => {
    fetchMock
      .mockResolvedValueOnce(json(500, { error: "boom" }))
      .mockResolvedValueOnce(json(200, body));

    await sendTransferWrite("/api/transfers", { method: "POST", body }, "Transfer", noSleep);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops on a refusal and surfaces the server's message", async () => {
    fetchMock.mockResolvedValueOnce(json(400, { error: "Cannot transfer to the same account" }));

    await expect(
      sendTransferWrite("/api/transfers", { method: "POST", body }, "Transfer", noSleep),
    ).rejects.toEqual(new TransferRefusedError("Cannot transfer to the same account"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up as unconfirmed (maybe saved) after the retry budget", async () => {
    fetchMock.mockImplementation(async () => {
      throw new RequestTimeoutError(15_000);
    });

    const error = await sendTransferWrite(
      "/api/transfers",
      { method: "POST", body },
      "Transfer",
      noSleep,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransferUnconfirmedError);
    expect((error as TransferUnconfirmedError).maybeSaved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry when known offline before sending", async () => {
    fetchMock.mockRejectedValueOnce(
      new OfflineError("Pre-flight: connectivity manager reports offline"),
    );

    const error = await sendTransferWrite(
      "/api/transfers",
      { method: "POST", body },
      "Transfer",
      noSleep,
    ).catch((e: unknown) => e);

    expect((error as TransferUnconfirmedError).maybeSaved).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("optimistic balances mirror the route", () => {
  it("moves Wallet 100 → 80 and Savings 50 → 70, and restores on rollback", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["account-balance", "wallet"], { balance: 100 });
    queryClient.setQueryData(["account-balance", "savings"], { balance: 50 });

    const snapshot = await shiftCachedBalances(queryClient, transferMoves(body));

    expect(queryClient.getQueryData(["account-balance", "wallet"])).toEqual({ balance: 80 });
    expect(queryClient.getQueryData(["account-balance", "savings"])).toEqual({ balance: 70 });

    for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
    expect(queryClient.getQueryData(["account-balance", "wallet"])).toEqual({ balance: 100 });
    expect(queryClient.getQueryData(["account-balance", "savings"])).toEqual({ balance: 50 });
  });

  it("reverses exactly (sign -1) for a delete", () => {
    expect(transferMoves(body, -1)).toEqual([
      { accountId: "wallet", delta: 20 },
      { accountId: "savings", delta: -20 },
    ]);
  });

  it("credits the converted amount on a cross-currency transfer", () => {
    expect(transferMoves({ ...body, to_amount: 1_790_000 })).toEqual([
      { accountId: "wallet", delta: -20 },
      { accountId: "savings", delta: 1_790_000 },
    ]);
  });

  it("debits the sender only the net on a household transfer with change returned", () => {
    expect(
      transferMoves({ ...body, transfer_type: "household", returned_amount: 5 }),
    ).toEqual([
      { accountId: "wallet", delta: -15 },
      { accountId: "savings", delta: 15 },
    ]);
  });

  it("ignores fee/returned on a self transfer, as the route does", () => {
    const row = optimisticTransfer(new QueryClient(), {
      ...body,
      fee_amount: 3,
      returned_amount: 5,
    });
    expect(row).toMatchObject({ id: ID, fee_amount: 0, returned_amount: 0, transfer_type: "self" });
    expect(transferMoves(row)[0].delta).toBe(-20);
  });

  it("recomputes to_amount at the stored rate when only the amount changes", () => {
    expect(nextToAmount({ to_amount: 1_790_000, exchange_rate: 89_500 }, { id: ID, amount: 30 })).toBe(
      2_685_000,
    );
    expect(nextToAmount({ to_amount: null, exchange_rate: null }, { id: ID, amount: 30 })).toBeNull();
  });
});
