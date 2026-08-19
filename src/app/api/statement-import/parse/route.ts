// src/app/api/statement-import/parse/route.ts
// Parse PDF/CSV bank statement and return extracted transactions

import {
  convertToUITransactions,
  detectFormat,
  parseCSV,
  parsePDFText,
} from "@/lib/bank-statement-parser";
import { supabaseServer } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Currency codes the app supports on an account — mirrors CURRENCY_SYMBOLS. */
const KNOWN_CURRENCIES = ["USD", "EUR", "GBP", "LBP", "AED", "TRY"] as const;

/**
 * Currency sniff from the statement header — deliberately strict.
 *
 * Only an explicit label ("Currency: EUR", "Account Currency - USD") counts. A
 * bare currency code appearing somewhere in the header is NOT evidence: these
 * statements carry product names like "Fresh USD Account" and multi-currency
 * headers list several codes, so a loose match reported a EUR statement as USD
 * and told the owner to import it somewhere else. When we can't prove the
 * currency we return null and say nothing, rather than warn wrongly.
 */
function detectStatementCurrency(text: string): string | null {
  const header = text.slice(0, 1200).toUpperCase();
  const labelled = header.match(
    new RegExp(`CURRENCY\\s*[:\\-]?\\s*(${KNOWN_CURRENCIES.join("|")})\\b`),
  );
  return labelled ? labelled[1] : null;
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const accountId = String(formData.get("account_id") || "");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // The target account is chosen BEFORE parsing: it is part of the row
    // fingerprint (hash v2) and decides which currency the amounts are in.
    if (!UUID_RE.test(accountId)) {
      return NextResponse.json(
        { error: "A valid account_id is required" },
        { status: 400 },
      );
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, currency")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or not owned by you" },
        { status: 403 },
      );
    }

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith(".pdf");
    const isCSV = fileName.endsWith(".csv");

    if (!isPDF && !isCSV) {
      return NextResponse.json(
        { error: "Only PDF and CSV files are supported" },
        { status: 400 }
      );
    }

    // Get user's merchant mappings from database
    const { data: mappingsData } = await supabase
      .from("merchant_mappings")
      .select("*")
      .eq("user_id", user.id);

    // Build mappings map
    const mappings = new Map<
      string,
      {
        category_id: string | null;
        subcategory_id: string | null;
        account_id: string | null;
        merchant_name: string;
      }
    >();

    // Add user's custom mappings (highest priority).
    //
    // Categories are strictly per-account (`user_categories.account_id` is NOT
    // NULL), so a mapping learned while importing a DIFFERENT account cannot
    // supply a category here — the commit route would reject every such row
    // with "Category belongs to a different account". Keep its friendly
    // merchant name (display + grouping only) and drop the category, which
    // simply leaves the row in "needs review" where it belongs.
    for (const m of mappingsData || []) {
      const sameAccount = m.account_id === accountId;
      mappings.set(m.merchant_pattern.toUpperCase(), {
        category_id: sameAccount ? m.category_id : null,
        subcategory_id: sameAccount ? m.subcategory_id : null,
        account_id: accountId,
        merchant_name: m.merchant_name,
      });
    }

    // Only the user's own learned mappings feed suggestions. A built-in
    // merchant list used to be merged in here with category_id: null, which
    // marked rows "matched" while leaving them uncategorized — they then
    // vanished from the needs-attention filter. `matched` now means exactly
    // "a learned mapping supplied a category".

    let text = "";
    let rawTransactions;

    if (isCSV) {
      // Read CSV file directly
      text = await file.text();
      rawTransactions = parseCSV(text);
    } else {
      // Parse PDF
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const { parsePDF } = await import("@/lib/pdf-parser");
        const pdfData = await parsePDF(buffer);
        text = pdfData.text;
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        return NextResponse.json(
          {
            error:
              "Failed to parse PDF. Try exporting as CSV from your bank instead.",
            details: String(pdfError),
          },
          { status: 400 }
        );
      }

      if (!text || text.trim().length < 50) {
        return NextResponse.json(
          {
            error:
              "Could not extract text from PDF. Try exporting as CSV from your bank.",
            details: "The PDF might be image-based or empty.",
          },
          { status: 400 }
        );
      }

      // Check if the text looks like CSV (sometimes PDFs contain tabular data nicely)
      const format = detectFormat(text);

      if (format === "csv") {
        rawTransactions = parseCSV(text);
      } else {
        rawTransactions = parsePDFText(text);
      }
    }

    if (rawTransactions.length === 0) {
      return NextResponse.json(
        {
          error: "No transactions found in the file.",
          details:
            "The parser couldn't identify any transaction rows. Make sure the file format matches your bank statement.",
          rawTextPreview: text.substring(0, 1000),
        },
        { status: 400 }
      );
    }

    // Convert to UI format with merchant matching
    const transactions = convertToUITransactions(
      rawTransactions,
      mappings,
      accountId,
    );

    const matchedCount = transactions.filter((t) => t.matched).length;
    const unmatchedCount = transactions.length - matchedCount;
    const statementCurrency = detectStatementCurrency(text);

    return NextResponse.json({
      transactions,
      matchedCount,
      unmatchedCount,
      totalCount: transactions.length,
      // Stable id for this exact file — the key a saved review session resumes
      // under, so re-uploading the same statement restores the work in progress.
      statement_id: createHash("sha256").update(text).digest("hex"),
      account_id: accountId,
      account_currency: account.currency,
      statement_currency: statementCurrency,
      currency_mismatch:
        !!statementCurrency && statementCurrency !== account.currency,
      rawTextPreview: text.substring(0, 500),
    });
  } catch (error) {
    console.error("Failed to parse statement:", error);
    return NextResponse.json(
      { error: "Failed to parse statement", details: String(error) },
      { status: 500 }
    );
  }
}
