import { describe, expect, it } from "vitest";
import {
  convertToUITransactions,
  parsePDFText,
} from "./bank-statement-parser";
import { isTransferDescription } from "./statement-reconcile";

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
