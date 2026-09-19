import { describe, expect, it } from "vitest";
import {
  convertToUITransactions,
  parsePDFText,
  parsePDFTextWithDiagnostics,
} from "./bank-statement-parser";
import { isPersonTransfer, isTransferDescription } from "./statement-reconcile";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";

/**
 * Text as the PDF extractor hands it over for the owner's bank: date, then the
 * description, then MONEY OUT / MONEY IN / BALANCE with "-" standing in for an
 * empty money column. The own-account rows are transcribed from a real
 * statement page — their descriptions genuinely contain " - " separators and a
 * trailing "-", which is what makes the amount split worth pinning.
 */
const STATEMENT = [
  "DATE TRANSACTIONS MONEY OUT MONEY IN BALANCE",
  "01/01/2026 Opening Balance 0.00",
  "07/08/2026 Own Account Exchange: USD to EUR at 0.852 - from 501400630004 - - 150.00 150.00",
  "07/08/2026 Own Account Exchange: EUR to USD at 1.140 - to 501400630004 - 150.00 - 0.00",
  "08/08/2026 POS Purchase ROADSTER BEIRUT LB 3043 45.50 - 104.50",
  "09/08/2026 Transfer to RACHA SAMIR TOUMA via Mobile - Car 200.00 - 55.00",
  "10/08/2026 Transfer from SALIM IBRAHIM SAADEH via Mobile - - 20.00 75.00",
].join("\n");

describe("parsePDFText", () => {
  it("splits an own-account row's amounts despite dashes inside the description", () => {
    const rows = parsePDFText(STATEMENT);

    // Opening Balance is dropped; the money rows survive.
    expect(rows).toHaveLength(5);

    expect(rows[0]).toMatchObject({
      date: "2026-08-07",
      description: "Own Account Exchange: USD to EUR at 0.852 - from 501400630004 -",
      moneyOut: null,
      moneyIn: 150,
      type: "transfer_in",
    });

    expect(rows[1]).toMatchObject({
      date: "2026-08-07",
      moneyOut: 150,
      moneyIn: null,
      type: "transfer_out",
    });
  });

  it("names the leg from the trailing account reference, not the currency pair", () => {
    // "USD to EUR" is the conversion; "- from 5014…" is the direction. Reading
    // the former is how the incoming leg used to be booked as a payment.
    const rows = parsePDFText(STATEMENT);
    expect(rows[0].type).toBe("transfer_in");
    expect(rows[0].description).toContain("USD to EUR");
  });

  it("still parses an ordinary purchase", () => {
    const rows = parsePDFText(STATEMENT);
    expect(rows[2]).toMatchObject({
      date: "2026-08-08",
      moneyOut: 45.5,
      moneyIn: null,
      type: "pos_purchase",
    });
  });
});

// Person-to-person transfers are real money and must survive parsing — they
// are not own-account moves and must be neither dropped nor mis-signed.
describe("person-to-person transfers", () => {
  it("parses both directions with the right sign", () => {
    const rows = parsePDFText(STATEMENT);
    expect(rows.find((r) => r.description.includes("RACHA"))).toMatchObject({
      date: "2026-08-09",
      moneyOut: 200,
      moneyIn: null,
      type: "transfer_out",
    });
    expect(rows.find((r) => r.description.includes("SALIM"))).toMatchObject({
      date: "2026-08-10",
      moneyOut: null,
      moneyIn: 20,
      type: "transfer_in",
    });
  });

  it("is not swept up by the own-account skip rule", () => {
    const rows = parsePDFText(STATEMENT).filter((r) =>
      r.description.includes("via Mobile"),
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(isTransferDescription(r.description), r.description).toBe(false);
    }
  });
});

describe("parser ↔ matcher agreement", () => {
  // The parser (server-only) and the matcher (bundled for the client) each
  // carry their own copy of the own-account rule. This is the test that stops
  // them drifting: whatever the parser calls a transfer, the matcher must skip.
  // The parser's `transfer_in`/`transfer_out` is a SHAPE label — it says the
  // line reads like a transfer, not that the money should be ignored. Only
  // OWN-account moves are skipped; a transfer to another person is real
  // spending. Those two ideas were the same thing until the split, and
  // conflating them again is what would silently drop a payment to a friend.
  it("skips own-account moves and only those", () => {
    const rows = parsePDFText(STATEMENT);

    for (const row of rows) {
      const ownAccount = /own account|account exchange/i.test(row.description);
      expect(isTransferDescription(row.description), row.description).toBe(
        ownAccount,
      );
    }
  });
});

describe("convertToUITransactions", () => {
  it("fingerprints own-account legs distinctly and leaves real spend alone", () => {
    const rows = convertToUITransactions(
      parsePDFText(STATEMENT),
      new Map(),
      ACCOUNT,
    );

    // The two legs are the same day and the same 150.00, so only direction and
    // description keep them apart — if the hash collapsed them, re-importing
    // would silently drop one.
    expect(rows[0].statement_hash).not.toBe(rows[1].statement_hash);
    expect(rows[0].type).toBe("credit");
    expect(rows[1].type).toBe("debit");

    // And the purchase is untouched by any of this.
    expect(rows[2]).toMatchObject({ type: "debit", amount: 45.5 });
    expect(isTransferDescription(rows[2].description)).toBe(false);
  });
});

// Transcribed from a real e-statement — both shapes the owner actually gets.
describe("cash withdrawals", () => {
  const WITHDRAWALS = [
    "DATE TRANSACTIONS MONEY OUT MONEY IN BALANCE",
    "01/01/2026 Opening Balance 0.00",
    "11/08/2026 Audi ATM Cash withdrawal 05606305 BANK AUDI HOLCOM-5 BEIRUT LB 7121 200.00 - 500.00",
    "12/08/2026 Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 MANSOURIEH LB for Voucher No 6755430378 - Car Insurance 30.42 - 469.58",
  ].join("\n");

  it("parses both real withdrawal shapes as debits typed cash_withdrawal", () => {
    const rows = parsePDFText(WITHDRAWALS);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      date: "2026-08-11",
      moneyOut: 200,
      moneyIn: null,
      type: "cash_withdrawal",
      merchantName: "ATM Cash Withdrawal",
    });

    // The memo after the first " - " is what the owner actually paid for —
    // it becomes the merchant name so the review UI shows it up front.
    expect(rows[1]).toMatchObject({
      date: "2026-08-12",
      moneyOut: 30.42,
      moneyIn: null,
      type: "cash_withdrawal",
      merchantName: "Car Insurance",
    });
  });

  it("is never swept up as an own-account transfer", () => {
    for (const row of parsePDFText(WITHDRAWALS)) {
      expect(isTransferDescription(row.description), row.description).toBe(
        false,
      );
    }
  });
});

describe("parsePDFText — three-decimal FX rates in the description", () => {
  // Verbatim from the owner's August statement. The rate has THREE decimals and
  // sits INSIDE the description, before the two-decimal money columns.
  const FX_ROW =
    "08/08/2026 Own Account Exchange: USD to EUR at 0.852 - to 501400630005 - 200.00 - 1,909.46";

  it("reads the money column, not the first two decimals of the rate", () => {
    const [tx] = parsePDFText(FX_ROW);

    // Was 0.85 — `[\d,]+\.\d{2}` matched inside "0.852", so the rate became the
    // amount and 137 exchange rows imported as $0.85 each.
    expect(tx.moneyOut).toBe(200);
    expect(tx.moneyIn).toBeNull();
    expect(tx.balance).toBe(1909.46);
  });

  it("keeps the rate and the counterparty account in the description", () => {
    const [tx] = parsePDFText(FX_ROW);

    // Was truncated at "…USD to EUR at", which is why classifyOwnExchange()
    // found no rate and the row stayed on Skipped as a plain own-account move.
    expect(tx.description).toBe(
      "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -",
    );
    expect(tx.type).toBe("transfer_out");
  });

  it("reads the incoming leg on the other account's statement", () => {
    const [tx] = parsePDFText(
      "08/08/2026 Own Account Exchange: USD to EUR at 0.852 - from 501400630004 - - 170.40 170.40",
    );

    expect(tx.moneyOut).toBeNull();
    expect(tx.moneyIn).toBe(170.4);
    expect(tx.type).toBe("transfer_in");
  });

  it("still parses an ordinary two-decimal row unchanged", () => {
    const [tx] = parsePDFText(
      "09/08/2026 POS PURCHASE SPINNEYS BEIRUT LB 3043 42.08 - 1,867.38",
    );

    expect(tx.moneyOut).toBe(42.08);
    expect(tx.balance).toBe(1867.38);
    expect(tx.description).toBe("POS PURCHASE SPINNEYS BEIRUT LB 3043");
  });

  it("parses consecutive rows independently", () => {
    // Guards the no-`g`-flag rule: a global regex reused across lines carries
    // `lastIndex` and would silently skip every other row.
    const rows = parsePDFText(
      [
        FX_ROW,
        "09/08/2026 Own Account Exchange: USD to EUR at 0.861 - to 501400630005 - 100.00 - 1,809.46",
        "10/08/2026 POS PURCHASE LE GRAY BEIRUT LB 1122 15.50 - 1,793.96",
      ].join("\n"),
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.moneyOut)).toEqual([200, 100, 15.5]);
  });
});

describe("parsePDFText — FX row wrapped across extracted lines", () => {
  // THE actual failure. The extractor hands the row over as three lines,
  // because the description wraps in the PDF's TRANSACTIONS column:
  //
  //   08/08/2026 Own Account Exchange: USD to EUR
  //   at 0.852 - to 501400630005 -
  //   200.00 - 1,909.46
  //
  // The continuation line has no two-decimal money on it, only the rate. With
  // the old `[\d,]+\.\d{2}` the loop treated it AS the numbers line, broke out,
  // and read "0.85" as MONEY OUT — so every exchange imported as $0.85 with the
  // rate missing from the description, which is why they all sat on Skipped as
  // plain own-account moves instead of reaching the Transfers tab.
  const WRAPPED = [
    "08/08/2026 Own Account Exchange: USD to EUR",
    "at 0.852 - to 501400630005 -",
    "200.00 - 1,909.46",
  ].join("\n");

  it("takes the amount from the money line, not from the rate", () => {
    const [tx] = parsePDFText(WRAPPED);

    expect(tx.moneyOut).toBe(200);
    expect(tx.moneyIn).toBeNull();
    expect(tx.balance).toBe(1909.46);
  });

  it("rejoins the wrapped description so the rate survives", () => {
    const [tx] = parsePDFText(WRAPPED);

    expect(tx.description).toBe(
      "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -",
    );
    expect(tx.type).toBe("transfer_out");
  });

  it("produces exactly one row, not one per wrapped line", () => {
    expect(parsePDFText(WRAPPED)).toHaveLength(1);
  });

  it("handles the wrapped incoming leg on the EUR statement", () => {
    const [tx] = parsePDFText(
      [
        "08/08/2026 Own Account Exchange: USD to EUR",
        "at 0.852 - from 501400630004 -",
        "- 170.40 170.40",
      ].join("\n"),
    );

    expect(tx.moneyOut).toBeNull();
    expect(tx.moneyIn).toBe(170.4);
    expect(tx.type).toBe("transfer_in");
  });

  it("still wraps an ordinary long merchant description", () => {
    const [tx] = parsePDFText(
      [
        "09/08/2026 POS PURCHASE SPINNEYS",
        "BEIRUT LB 3043",
        "42.08 - 1,867.38",
      ].join("\n"),
    );

    expect(tx.description).toBe("POS PURCHASE SPINNEYS BEIRUT LB 3043");
    expect(tx.moneyOut).toBe(42.08);
  });
});

// Transcribed verbatim (names changed) from the real corpus: the description
// wraps onto TWO extra physical lines that carry no date of their own, one
// BEFORE the amounts and one AFTER. The bank prints the date next to the
// amounts here, not next to the first line of the description — the reverse
// of every other wrap shape above.
describe("parsePDFText — description wraps around a dateless amounts line", () => {
  const ROWS = [
    "17/06/2026 POS Purchase SPINNEYS MTAYLEB",
    "MTAYLEB LB 0000",
    "95.24 - 206.97",
    "Transfer to JOHN GEORGES",
    "YAZBECK via Mobile - malak el",
    "18/06/2026 14.00 - 192.97",
    "tawouk 2 burgers",
    "18/06/2026 Bill Payment, Invoice # ALFA PREPAID 17.04 - 175.93",
  ].join("\n");

  it("does not merge the transfer into the row before it", () => {
    const rows = parsePDFText(ROWS);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: "2026-06-17",
      description: "POS Purchase SPINNEYS MTAYLEB MTAYLEB LB 0000",
      moneyOut: 95.24,
    });
  });

  it("recovers the leading wrap (before the amounts) AND the trailing wrap (after them)", () => {
    const [, tx] = parsePDFText(ROWS);
    expect(tx).toMatchObject({
      date: "2026-06-18",
      description: "Transfer to JOHN GEORGES YAZBECK via Mobile - malak el tawouk 2 burgers",
      moneyOut: 14,
      moneyIn: null,
      balance: 192.97,
      type: "transfer_out",
      merchantName: "Transfer to JOHN GEORGES YAZBECK",
    });
  });

  it("classifies as a person transfer, not an unmatched review row", () => {
    const [, tx] = parsePDFText(ROWS);
    expect(isPersonTransfer(tx.description)).toBe(true);
    expect(isTransferDescription(tx.description)).toBe(false);
  });

  it("leaves the next row untouched", () => {
    const [, , next] = parsePDFText(ROWS);
    expect(next).toMatchObject({
      date: "2026-06-18",
      moneyOut: 17.04,
    });
  });
});

// A mobile transfer whose description continuation line carries the outgoing
// amount as text ("via Mobile - Out: 105.02") while the real MONEY OUT / MONEY
// IN / BALANCE columns sit on the following line. The embedded number must not
// be mistaken for the amounts column, or the row is dropped and the whole
// import fails with a 422 (a rejected row blocks the batch).
describe("parsePDFText — embedded amount in a wrapped description line", () => {
  const ROWS = [
    "14/08/2026 Transfer to RACHA SAMIR TOUMA",
    "via Mobile - Out: 105.02",
    "31.46 - 323.03",
  ].join("\n");

  it("reads the real money columns, not the number inside the description", () => {
    const rows = parsePDFText(ROWS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-08-14",
      description: "Transfer to RACHA SAMIR TOUMA via Mobile - Out: 105.02",
      moneyOut: 31.46,
      moneyIn: null,
      balance: 323.03,
      type: "transfer_out",
    });
  });

  it("is not rejected, so the import is not blocked with a 422", () => {
    const { diagnostics } = parsePDFTextWithDiagnostics(ROWS);
    expect(diagnostics).toMatchObject({
      candidate_count: 1,
      parsed_count: 1,
      rejected_count: 0,
    });
  });
});

describe("parsePDFText — document authenticity footer", () => {
  // Printed once at the very bottom of the statement (these PDFs are one
  // tall page, not paginated). It has no date and no money of its own, so
  // without filtering it out it reads exactly like a wrapped continuation
  // and gets glued onto the last real transaction above it.
  const WITH_FOOTER = [
    "20/08/2026 POS Purchase SPINNEYS MTAYLEB",
    "MTAYLEB LB 0000",
    "154.06 - 62.07",
    "For Verifications",
    "Scan the QR code",
    "This Tamperproof is digitally signed.",
    "Both printed and electronic copies can instantly be verified by scanning the QR code. © Neo by Bank Audi 2023",
    "Bank Audi Plaza, Omar Daouk Street, Bab Idriss, Beirut 8102 2021, P.O. Box: 2560-11, Beirut, Lebanon.",
  ].join("\n");

  it("is dropped instead of being appended to the last transaction", () => {
    const [tx] = parsePDFText(WITH_FOOTER);
    expect(tx.description).toBe("POS Purchase SPINNEYS MTAYLEB MTAYLEB LB 0000");
    expect(parsePDFText(WITH_FOOTER)).toHaveLength(1);
  });
});
