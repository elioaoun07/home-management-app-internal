import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertToUITransactions,
  parsePDFTextWithDiagnostics,
} from "./bank-statement-parser";
import { parsePDF } from "./pdf-parser";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";

type CorpusCase = {
  file: string;
  rows: number;
  credits: number;
  debits: number;
  semantic: Record<string, number>;
};

const CORPUS: CorpusCase[] = [
  {
    file: "account_statement_Debit_2025-2026.pdf",
    rows: 390,
    credits: 93,
    debits: 297,
    semantic: {
      own_transfer: 87,
      other: 282,
      person_transfer: 15,
      bank_fee: 5,
      voucher_withdrawal: 1,
    },
  },
  {
    file: "account_statement_Salary_2025-2026.pdf",
    rows: 154,
    credits: 22,
    debits: 132,
    semantic: {
      salary_income: 14,
      bank_fee: 14,
      own_transfer: 96,
      atm_withdrawal: 14,
      voucher_withdrawal: 1,
      exchange: 12,
      other: 1,
      person_transfer: 2,
    },
  },
  {
    file: "account_statement_Savings_2025-2026.pdf",
    rows: 32,
    credits: 12,
    debits: 20,
    semantic: {
      own_transfer: 11,
      other: 14,
      person_transfer: 3,
      exchange: 4,
    },
  },
];

describe("real statement PDF corpus", () => {
  for (const corpus of CORPUS) {
    it(`preserves every money column in ${corpus.file}`, async () => {
      const buffer = readFileSync(resolve(process.cwd(), corpus.file));
      const pdf = await parsePDF(buffer);
      const parsed = parsePDFTextWithDiagnostics(pdf.text);

      expect(parsed.diagnostics).toMatchObject({
        candidate_count: corpus.rows,
        parsed_count: corpus.rows,
        rejected_count: 0,
      });
      expect(parsed.transactions).toHaveLength(corpus.rows);
      expect(parsed.transactions.filter((row) => row.moneyIn !== null)).toHaveLength(
        corpus.credits,
      );
      expect(
        parsed.transactions.filter((row) => row.moneyOut !== null),
      ).toHaveLength(corpus.debits);

      const semanticCounts: Record<string, number> = {};
      for (const row of convertToUITransactions(
        parsed.transactions,
        new Map(),
        ACCOUNT,
      )) {
        const kind = row.semantic_kind ?? "other";
        semanticCounts[kind] = (semanticCounts[kind] ?? 0) + 1;
      }
      expect(semanticCounts).toEqual(corpus.semantic);
    });
  }

  it("reports a dated block whose money columns cannot be decoded", () => {
    const parsed = parsePDFTextWithDiagnostics(
      [
        "DATE TRANSACTIONS MONEY OUT MONEY IN BALANCE",
        "29/07/2025 Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX",
        "-2,534.002,534.00",
      ].join("\n"),
    );

    expect(parsed.transactions).toHaveLength(0);
    expect(parsed.diagnostics).toMatchObject({
      candidate_count: 1,
      parsed_count: 0,
      rejected_count: 1,
    });
    expect(parsed.diagnostics.rejected[0]?.block).toContain("Incoming Payments");
  });
});
