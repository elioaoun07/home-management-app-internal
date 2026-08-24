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
].join("\n");

describe("parsePDFText", () => {
  it("splits an own-account row's amounts despite dashes inside the description", () => {
    const rows = parsePDFText(STATEMENT);

    // Opening Balance is dropped; the three money rows survive.
    expect(rows).toHaveLength(3);

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

describe("parser ↔ matcher agreement", () => {
  // The parser (server-only) and the matcher (bundled for the client) each
  // carry their own copy of the own-account rule. This is the test that stops
  // them drifting: whatever the parser calls a transfer, the matcher must skip.
  it("every row the parser types as a transfer is skipped by the matcher", () => {
    const rows = parsePDFText(STATEMENT);

    for (const row of rows) {
      const parserSaysTransfer =
        row.type === "transfer_in" || row.type === "transfer_out";
      expect(isTransferDescription(row.description), row.description).toBe(
        parserSaysTransfer,
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
