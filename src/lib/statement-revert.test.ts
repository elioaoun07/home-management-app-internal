import { describe, expect, it } from "vitest";
import type { AccountType } from "@/lib/balance-utils";
import {
  hasDrifted,
  planRevert,
  type LedgerEntry,
  type LiveTransaction,
} from "@/lib/statement-revert";

const ACCOUNT = "acc-expense";
const SAVING = "acc-saving";

const accountTypes = new Map<string, AccountType>([
  [ACCOUNT, "expense"],
  [SAVING, "saving"],
]);

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "entry-1",
    action: "create",
    transaction_id: "tx-1",
    account_id: ACCOUNT,
    statement_hash: "hash-1",
    previous: {},
    applied: { amount: 45.5, is_debt_return: false },
    reverted_at: null,
    ...overrides,
  };
}

function tx(overrides: Partial<LiveTransaction> = {}): LiveTransaction {
  return {
    id: "tx-1",
    amount: 45.5,
    is_draft: false,
    deleted_at: null,
    statement_hash: "hash-1",
    is_debt_return: false,
    account_id: ACCOUNT,
    ...overrides,
  };
}

const liveMap = (...rows: LiveTransaction[]) =>
  new Map(rows.map((r) => [r.id, r]));

describe("planRevert — creates", () => {
  it("soft-deletes the row, frees the hash, and gives the money back", () => {
    const { plans, deltas, counts } = planRevert(
      [entry()],
      liveMap(tx()),
      accountTypes,
      "2026-08-19T10:00:00.000Z",
    );

    expect(plans[0]).toMatchObject({
      note: "reverted",
      // Freeing the fingerprint is what makes the statement re-importable.
      update: { deleted_at: "2026-08-19T10:00:00.000Z", statement_hash: null },
      guard: { id: "tx-1", deleted_at: null },
    });
    // Expense create was −45.50; removing it is +45.50.
    expect(deltas[ACCOUNT]).toBe(45.5);
    expect(counts.deleted).toBe(1);
  });

  it("takes a refund back out of the balance", () => {
    // Credits are stored positive with is_debt_return, so they ADDED money.
    const { deltas } = planRevert(
      [entry({ applied: { amount: 20, is_debt_return: true } })],
      liveMap(tx({ amount: 20, is_debt_return: true })),
      accountTypes,
    );

    expect(deltas[ACCOUNT]).toBe(-20);
  });

  it("reverses what the balance HOLDS, not what the import wrote", () => {
    // The user edited 45.50 → 60 after importing; the balance already moved to
    // match. Reversing the original 45.50 would leave the account 14.50 off.
    const { deltas, counts } = planRevert(
      [entry()],
      liveMap(tx({ amount: 60 })),
      accountTypes,
    );

    expect(deltas[ACCOUNT]).toBe(60);
    expect(counts.removed_after_edit).toBe(1);
  });

  it("leaves a row already in the Recycle Bin alone", () => {
    // Deleting it already reversed the balance — doing it again would double.
    const { plans, deltas, counts } = planRevert(
      [entry()],
      liveMap(tx({ deleted_at: "2026-08-18T00:00:00.000Z" })),
      accountTypes,
    );

    expect(plans[0].note).toBe("already_undone");
    expect(deltas).toEqual({});
    expect(counts.already_undone).toBe(1);
  });

  it("reports a purged transaction instead of guessing", () => {
    const { plans, deltas, counts } = planRevert(
      [entry()],
      new Map(),
      accountTypes,
    );

    expect(plans[0].note).toBe("gone");
    expect(deltas).toEqual({});
    expect(counts.gone).toBe(1);
  });
});

describe("planRevert — stamps", () => {
  const stamp = (o: Partial<LedgerEntry> = {}) =>
    entry({
      action: "stamp",
      previous: { amount: 80, statement_hash: null },
      applied: { amount: 80, statement_hash: "hash-1" },
      ...o,
    });

  it("un-stamps with no balance effect, because stamping had none", () => {
    const { plans, deltas, counts } = planRevert(
      [stamp()],
      liveMap(tx({ amount: 80 })),
      accountTypes,
    );

    expect(plans[0]).toMatchObject({
      note: "reverted",
      update: { statement_hash: null },
      guard: { id: "tx-1", statement_hash: "hash-1" },
      delta: 0,
    });
    expect(deltas).toEqual({});
    expect(counts.unstamped).toBe(1);
  });

  it("restores the user's own amount when the import took the bank's", () => {
    // Stamp with accept_amount: 82.50 replaced the user's 80.00.
    const { plans, deltas } = planRevert(
      [
        stamp({
          previous: { amount: 80, statement_hash: null },
          applied: { amount: 82.5, statement_hash: "hash-1" },
        }),
      ],
      liveMap(tx({ amount: 82.5 })),
      accountTypes,
    );

    expect(plans[0].update).toMatchObject({ amount: 80, statement_hash: null });
    // −82.50 removed, −80.00 re-applied → +2.50 back to the balance.
    expect(deltas[ACCOUNT]).toBeCloseTo(2.5, 10);
  });

  it("keeps a newer human edit rather than overwriting it", () => {
    // Import set 82.50; the user has since corrected it to 90. Their edit
    // already moved the balance, so un-stamping must not touch either.
    const { plans, deltas } = planRevert(
      [
        stamp({
          previous: { amount: 80, statement_hash: null },
          applied: { amount: 82.5, statement_hash: "hash-1" },
        }),
      ],
      liveMap(tx({ amount: 90 })),
      accountTypes,
    );

    expect(plans[0].update).toEqual({ statement_hash: null });
    expect(plans[0].editedSince).toBe(true);
    expect(deltas).toEqual({});
  });

  it("refuses to strip a fingerprint another import now owns", () => {
    const { plans, counts } = planRevert(
      [stamp()],
      liveMap(tx({ amount: 80, statement_hash: "hash-from-a-later-import" })),
      accountTypes,
    );

    expect(plans[0].note).toBe("drifted");
    expect(counts.drifted).toBe(1);
  });

  it("treats an already-cleared hash as done", () => {
    const { plans, counts } = planRevert(
      [stamp()],
      liveMap(tx({ amount: 80, statement_hash: null })),
      accountTypes,
    );

    expect(plans[0].note).toBe("already_undone");
    expect(counts.already_undone).toBe(1);
  });
});

describe("planRevert — confirmed drafts", () => {
  const confirm = (o: Partial<LedgerEntry> = {}) =>
    entry({
      action: "confirm_draft",
      previous: {
        amount: 12.75,
        is_draft: true,
        category_id: "cat-old",
        subcategory_id: null,
        statement_hash: null,
      },
      applied: {
        amount: 12.75,
        is_draft: false,
        category_id: "cat-new",
        statement_hash: "hash-1",
      },
      ...o,
    });

  it("puts the draft back with its original category and amount", () => {
    const { plans, deltas, counts } = planRevert(
      [confirm()],
      liveMap(tx({ amount: 12.75 })),
      accountTypes,
    );

    expect(plans[0]).toMatchObject({
      note: "reverted",
      update: {
        is_draft: true,
        statement_hash: null,
        amount: 12.75,
        category_id: "cat-old",
        subcategory_id: null,
      },
      guard: { id: "tx-1", statement_hash: "hash-1", is_draft: false },
    });
    // A draft is not counted in the stored balance, so the confirmed −12.75
    // has to come back out.
    expect(deltas[ACCOUNT]).toBe(12.75);
    expect(counts.redrafted).toBe(1);
  });

  it("does not re-draft a row that is already a draft", () => {
    const { plans, deltas } = planRevert(
      [confirm()],
      liveMap(tx({ amount: 12.75, is_draft: true })),
      accountTypes,
    );

    expect(plans[0].note).toBe("already_undone");
    expect(deltas).toEqual({});
  });
});

describe("planRevert — the whole batch", () => {
  // The exact inverse of the commit route's worked example. That import took an
  // expense account from $1,000.00 to $961.75 (net −38.25); reverting it must
  // land back on $1,000.00 to the cent.
  const ledger: LedgerEntry[] = [
    entry({
      id: "e-create",
      transaction_id: "tx-spinneys",
      applied: { amount: 45.5, is_debt_return: false },
      statement_hash: "h-spinneys",
    }),
    entry({
      id: "e-stamp",
      action: "stamp",
      transaction_id: "tx-roadster",
      statement_hash: "h-roadster",
      previous: { amount: 80, statement_hash: null },
      applied: { amount: 80, statement_hash: "h-roadster" },
    }),
    entry({
      id: "e-refund",
      transaction_id: "tx-refund",
      statement_hash: "h-refund",
      applied: { amount: 20, is_debt_return: true },
    }),
    entry({
      id: "e-taxi",
      action: "confirm_draft",
      transaction_id: "tx-taxi",
      statement_hash: "h-taxi",
      previous: {
        amount: 12.75,
        is_draft: true,
        category_id: "cat-transport",
        subcategory_id: null,
        statement_hash: null,
      },
      applied: { amount: 12.75, is_draft: false, statement_hash: "h-taxi" },
    }),
  ];

  const live = liveMap(
    tx({ id: "tx-spinneys", amount: 45.5, statement_hash: "h-spinneys" }),
    tx({ id: "tx-roadster", amount: 80, statement_hash: "h-roadster" }),
    tx({
      id: "tx-refund",
      amount: 20,
      is_debt_return: true,
      statement_hash: "h-refund",
    }),
    tx({ id: "tx-taxi", amount: 12.75, statement_hash: "h-taxi" }),
  );

  it("returns the balance to exactly where it stood before the import", () => {
    const { deltas, counts } = planRevert(ledger, live, accountTypes);

    //  create 45.50 → +45.50 · stamp → 0 · refund 20 → −20.00 · draft → +12.75
    expect(deltas[ACCOUNT]).toBeCloseTo(38.25, 10);
    expect(counts).toMatchObject({ deleted: 2, unstamped: 1, redrafted: 1 });
  });

  it("moves nothing on a second pass", () => {
    const settled = ledger.map((e) => ({
      ...e,
      reverted_at: "2026-08-19T10:00:00.000Z",
    }));

    const { deltas, counts, plans } = planRevert(settled, live, accountTypes);

    expect(deltas).toEqual({});
    expect(counts.already_undone).toBe(4);
    expect(plans.every((p) => Object.keys(p.update).length === 0)).toBe(true);
  });

  it("skips a row whose account it cannot price", () => {
    // Account deleted or not owned → the delta is uncomputable, so hands off.
    const { plans, deltas } = planRevert(ledger, live, new Map());

    expect(plans.every((p) => p.note === "drifted")).toBe(true);
    expect(deltas).toEqual({});
  });

  it("gets the direction right on a saving account", () => {
    // A saving-account create ADDS money, so reverting it takes money out.
    const { deltas } = planRevert(
      [entry({ account_id: SAVING })],
      liveMap(tx({ account_id: SAVING })),
      accountTypes,
    );

    expect(deltas[SAVING]).toBe(-45.5);
  });
});

describe("planRevert — create_transfer", () => {
  // A self transfer (cash withdrawal -> wallet) reverts exactly like a
  // household one: the ledger entry only records the NET effect, so the
  // planner doesn't need to know which shape it is — it just undoes both legs.
  it("reverts a self transfer's both legs from the entry alone", () => {
    const WALLET = "acc-wallet";
    const transferEntry: LedgerEntry = {
      id: "entry-1",
      action: "create_transfer",
      transaction_id: null,
      transfer_id: "tr-1",
      account_id: ACCOUNT,
      statement_hash: "hash-1",
      previous: {},
      applied: { amount: 200, to_account_id: WALLET, to_delta: 200 },
      reverted_at: null,
    };

    const { plans, deltas, counts } = planRevert(
      [transferEntry],
      liveMap(),
      accountTypes,
    );

    // The statement account gave up 200 (create_transfer's fromDelta was
    // -200), so undoing it gives it back; the wallet received +200, so
    // undoing it takes that back out.
    expect(deltas[ACCOUNT]).toBe(200);
    expect(deltas[WALLET]).toBe(-200);
    expect(counts.transfers_deleted).toBe(1);
    expect(plans[0]).toMatchObject({
      action: "create_transfer",
      note: "reverted",
      guard: { id: "tr-1", from_account_id: ACCOUNT, to_account_id: WALLET },
    });
  });

  // An FX exchange moves DIFFERENT numbers on the two sides (200.00 USD out,
  // 170.40 EUR in), so a revert that assumed symmetry would leave the EUR
  // account 29.60 over. The planner reads `to_delta` off the entry rather than
  // re-deriving it from `amount`, which is what makes this work unchanged.
  it("reverts a cross-currency exchange by the amount each side actually moved", () => {
    const EUR = "acc-eur";
    const { deltas, counts } = planRevert(
      [
        {
          id: "entry-fx",
          action: "create_transfer",
          transaction_id: null,
          transfer_id: "tr-fx",
          account_id: ACCOUNT,
          statement_hash: "hash-fx",
          previous: {},
          applied: { amount: 200, to_account_id: EUR, to_delta: 170.4 },
          reverted_at: null,
        },
      ],
      liveMap(),
      accountTypes,
    );

    expect(deltas[ACCOUNT]).toBe(200);
    expect(deltas[EUR]).toBe(-170.4);
    expect(counts.transfers_deleted).toBe(1);
  });

  it("skips a transfer the entry never actually recorded (transfer_id missing)", () => {
    const { plans, counts } = planRevert(
      [
        {
          id: "entry-1",
          action: "create_transfer",
          transaction_id: null,
          transfer_id: null,
          account_id: ACCOUNT,
          statement_hash: "hash-1",
          previous: {},
          applied: { amount: 200 },
          reverted_at: null,
        },
      ],
      liveMap(),
      accountTypes,
    );

    expect(plans[0].note).toBe("gone");
    expect(counts.gone).toBe(1);
  });
});

describe("hasDrifted", () => {
  it("flags an edited amount on a created row", () => {
    expect(hasDrifted(entry(), tx({ amount: 60 }))).toBe(true);
    expect(hasDrifted(entry(), tx())).toBe(false);
  });

  it("tolerates sub-cent numeric round-tripping", () => {
    expect(hasDrifted(entry(), tx({ amount: 45.500000001 }))).toBe(false);
  });

  it("flags a stamp whose fingerprint changed", () => {
    const stamp = entry({
      action: "stamp",
      applied: { amount: 80, statement_hash: "hash-1" },
    });
    expect(hasDrifted(stamp, tx({ amount: 80, statement_hash: "other" }))).toBe(
      true,
    );
  });
});
