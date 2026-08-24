import { describe, expect, it } from "vitest";
import type { StatementSession } from "@/lib/statementImportSession";
import type { ParsedTransaction } from "@/types/statement";
import {
  bucketCounts,
  buildCommitActions,
  buildReviewGroups,
  countUndecided,
  getBucket,
  resolveRowCategory,
} from "./sessionModel";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const CAT_FOOD = "22222222-2222-4222-8222-222222222222";
const CAT_TRAVEL = "33333333-3333-4333-8333-333333333333";

function row(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    id: "row-1",
    date: "2026-08-12",
    description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
    amount: 80,
    type: "debit",
    matched: false,
    selected: true,
    normalized_key: "le gray",
    account_id: ACCOUNT,
    statement_hash: "hash-1",
    ...overrides,
  };
}

function session(overrides: Partial<StatementSession> = {}): StatementSession {
  return {
    id: "statement-1",
    file_name: "july.pdf",
    account_id: ACCOUNT,
    account_name: "Trip - Italy",
    account_currency: "EUR",
    created_at: 0,
    updated_at: 0,
    rows: [row()],
    classifications: { "row-1": { status: "unmatched" } },
    decisions: {},
    group_categories: {},
    ...overrides,
  };
}

describe("getBucket", () => {
  it("treats an auto-matched row as done", () => {
    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 2,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
        undefined,
      ),
    ).toBe("matched");
  });

  it("keeps a probable match in review until the user accepts it", () => {
    const probable = {
      status: "probable" as const,
      transaction_id: "tx-1",
      kind: "confirmed" as const,
      amount_diff: 3.6,
      date_diff: 1,
      description: "Le Gray",
      date: "2026-08-11",
      amount: 76.4,
    };
    expect(getBucket(probable, undefined)).toBe("review");
    expect(getBucket(probable, { resolution: "accept_match" })).toBe("matched");
  });

  it("sends transfers and explicit skips to the skipped bucket", () => {
    expect(getBucket({ status: "transfer" }, undefined)).toBe("skipped");
    expect(getBucket({ status: "unmatched" }, { resolution: "skip" })).toBe(
      "skipped",
    );
  });

  it("separates an already-imported row from a match against a manual log", () => {
    // Both are no-ops at commit time, but they are different claims: one is a
    // fingerprint hit, the other is the matcher's judgement. Merging them hid
    // the judgements inside the certainties.
    expect(
      getBucket(
        {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-old",
        },
        undefined,
      ),
    ).toBe("imported");

    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
        undefined,
      ),
    ).toBe("matched");
  });

  it("returns a detached match to review", () => {
    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 0,
          description: "x",
          date: "2026-08-12",
          amount: 80,
        },
        { resolution: "create" },
      ),
    ).toBe("review");
  });
});

describe("resolveRowCategory", () => {
  it("prefers a per-row category over the group's", () => {
    const s = session({
      decisions: { "row-1": { resolution: "create", category_id: CAT_TRAVEL } },
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s)).toEqual({
      category_id: CAT_TRAVEL,
      subcategory_id: null,
    });
  });

  it("inherits the group's category when the row has none", () => {
    const s = session({
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s)).toEqual({
      category_id: CAT_FOOD,
      subcategory_id: null,
    });
  });

  it("honors an explicit per-row clear (null) over the group", () => {
    const s = session({
      decisions: { "row-1": { resolution: "create", category_id: null } },
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s).category_id).toBeNull();
  });
});

describe("buildReviewGroups", () => {
  it("keeps different merchants apart even when the first word matches", () => {
    const s = session({
      rows: [
        row({ id: "a", normalized_key: "le gray", statement_hash: "h-a" }),
        row({ id: "b", normalized_key: "le mall", statement_hash: "h-b" }),
        row({ id: "c", normalized_key: "le gray", statement_hash: "h-c" }),
      ],
      classifications: {
        a: { status: "unmatched" },
        b: { status: "unmatched" },
        c: { status: "unmatched" },
      },
    });

    const groups = buildReviewGroups(s);
    expect(groups.map((g) => g.key)).toEqual(["le gray", "le mall"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("gives a detached row its own group", () => {
    const s = session({
      rows: [
        row({ id: "a", statement_hash: "h-a" }),
        row({ id: "b", statement_hash: "h-b" }),
      ],
      classifications: {
        a: { status: "unmatched" },
        b: { status: "unmatched" },
      },
      decisions: { b: { resolution: "create", detached_from_group: true } },
    });

    const groups = buildReviewGroups(s);
    expect(groups).toHaveLength(2);
    expect(groups.some((g) => g.key.startsWith("__row__:b"))).toBe(true);
  });
});

describe("buildCommitActions", () => {
  it("stamps an auto-matched row without creating anything", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 2,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "stamp",
        row_id: "row-1",
        transaction_id: "tx-1",
        statement_hash: "hash-1",
      },
    ]);
  });

  it("confirms a matched draft instead of stamping it", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-draft",
          kind: "draft",
          amount_diff: 0,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 80,
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "confirm_draft",
      transaction_id: "tx-draft",
    });
  });

  it("passes the accepted bank amount through on a probable match", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "probable",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 3.6,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 76.4,
        },
      },
      decisions: {
        "row-1": { resolution: "accept_match", accept_amount: 80 },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "stamp",
      accept_amount: 80,
    });
  });

  it("creates an unmatched row once it has a category, and learns the merchant", () => {
    const s = session({
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "create",
        row_id: "row-1",
        date: "2026-08-12",
        description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        amount: 80,
        direction: "debit",
        account_id: ACCOUNT,
        category_id: CAT_FOOD,
        subcategory_id: null,
        statement_hash: "hash-1",
        learn_mapping: { pattern: "LE GRAY", name: "Le Gray" },
      },
    ]);
  });

  // Regression: the create action used to take its account from the row's
  // merchant mapping and skip the row when there wasn't one. On a first import
  // nothing has been learned yet, so EVERY row was silently dropped and Commit
  // reported "0 created" with no error. A statement belongs to one account —
  // the session's — and that is also the account baked into the row's hash.
  // The rename is the whole point of this pair: the ledger gets the owner's
  // words, the fingerprint keeps the bank's, so next month's import of the same
  // statement still reads as already-imported.
  it("stores the user's rename but fingerprints the bank's raw text", () => {
    const s = session({
      rows: [
        row({
          description: "PrePaid",
          statement_hash: "hash-prepaid",
        }),
      ],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          description: "ALFA Prepaid Phone",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      description: "ALFA Prepaid Phone",
      statement_hash: "hash-prepaid",
    });
  });

  it("falls back to the bank text when a rename is blank", () => {
    const s = session({
      rows: [row({ description: "PrePaid" })],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          description: "   ",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ description: "PrePaid" });
  });

  // Bank fees riding along on a salary statement belong to the expenses
  // account, not to salary. The override moves the transaction; it must NOT
  // move the fingerprint, which stays keyed to the statement's account.
  it("honours a per-row account override without touching the hash", () => {
    const s = session({
      rows: [row({ statement_hash: "hash-fee" })],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          account_id: "22222222-2222-4222-8222-222222222222",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "create",
      account_id: "22222222-2222-4222-8222-222222222222",
      statement_hash: "hash-fee",
    });
  });

  it("falls back to the statement account when no override is set", () => {
    const s = session({
      rows: [row()],
      decisions: { "row-1": { resolution: "create", category_id: CAT_FOOD } },
    });
    expect(buildCommitActions(s)[0]).toMatchObject({ account_id: ACCOUNT });
  });

  it("creates into the session account when no mapping supplied one", () => {
    const s = session({
      rows: [row({ account_id: null })],
      decisions: {
        "row-1": { resolution: "create", category_id: CAT_FOOD },
      },
    });

    expect(buildCommitActions(s)).toHaveLength(1);
    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "create",
      account_id: ACCOUNT,
    });
  });

  it("ignores a mapping that points at a different account", () => {
    // Otherwise the fingerprint (hashed with the session account) would guard a
    // transaction written to another account entirely.
    const s = session({
      rows: [row({ account_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })],
      decisions: {
        "row-1": { resolution: "create", category_id: CAT_FOOD },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ account_id: ACCOUNT });
  });

  it("uses an edited date when the user corrected the posting lag", () => {
    const s = session({
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          date: "2026-08-10",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ date: "2026-08-10" });
  });

  it("writes nothing for rows that are skipped, transfers, already imported, or uncategorized", () => {
    const s = session({
      rows: [
        row({ id: "skip", statement_hash: "h-1" }),
        row({ id: "xfer", statement_hash: "h-2" }),
        row({ id: "dupe", statement_hash: "h-3" }),
        row({ id: "blank", statement_hash: "h-4" }),
      ],
      classifications: {
        skip: { status: "unmatched" },
        xfer: { status: "transfer" },
        dupe: {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-old",
        },
        blank: { status: "unmatched" },
      },
      decisions: { skip: { resolution: "skip", category_id: CAT_FOOD } },
    });

    expect(buildCommitActions(s)).toEqual([]);
  });

  it("requires a chosen candidate before committing an ambiguous row", () => {
    const ambiguous = {
      status: "ambiguous" as const,
      candidates: [
        {
          transaction_id: "tx-a",
          kind: "confirmed" as const,
          amount_diff: 0,
          date_diff: 1,
          description: "a",
          date: "2026-08-11",
          amount: 80,
        },
        {
          transaction_id: "tx-b",
          kind: "confirmed" as const,
          amount_diff: 0,
          date_diff: 1,
          description: "b",
          date: "2026-08-11",
          amount: 80,
        },
      ],
    };

    const undecided = session({ classifications: { "row-1": ambiguous } });
    expect(buildCommitActions(undecided)).toEqual([]);

    const picked = session({
      classifications: { "row-1": ambiguous },
      decisions: {
        "row-1": { resolution: "link", linked_transaction_id: "tx-b" },
      },
    });
    expect(buildCommitActions(picked)[0]).toMatchObject({
      kind: "stamp",
      transaction_id: "tx-b",
    });
  });
});

describe("counters", () => {
  it("counts only review rows still missing a category", () => {
    const s = session({
      rows: [
        row({ id: "needs", statement_hash: "h-1" }),
        row({ id: "done", statement_hash: "h-2" }),
      ],
      classifications: {
        needs: { status: "unmatched" },
        done: { status: "unmatched" },
      },
      decisions: { done: { resolution: "create", category_id: CAT_FOOD } },
    });

    expect(countUndecided(s)).toBe(1);
    expect(bucketCounts(s)).toEqual({
      matched: 0,
      imported: 0,
      review: 2,
      skipped: 0,
    });
  });
});
