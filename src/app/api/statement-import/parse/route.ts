// src/app/api/statement-import/parse/route.ts
// Parse PDF/CSV bank statement and return extracted transactions

import {
  convertToUITransactions,
  detectFormat,
  LEBANESE_MERCHANTS,
  parseCSV,
  parsePDFText,
} from "@/lib/bank-statement-parser";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

    // Add user's custom mappings (highest priority)
    for (const m of mappingsData || []) {
      mappings.set(m.merchant_pattern.toUpperCase(), {
        category_id: m.category_id,
        subcategory_id: m.subcategory_id,
        account_id: m.account_id,
        merchant_name: m.merchant_name,
      });
    }

    // Add known Lebanese merchants (lower priority, won't override user mappings)
    for (const km of LEBANESE_MERCHANTS) {
      if (!mappings.has(km.pattern.toUpperCase())) {
        mappings.set(km.pattern.toUpperCase(), {
          category_id: null,
          subcategory_id: null,
          account_id: null,
          merchant_name: km.name,
        });
      }
    }

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
    const transactions = convertToUITransactions(rawTransactions, mappings);

    const matchedCount = transactions.filter((t) => t.matched).length;
    const unmatchedCount = transactions.length - matchedCount;

    return NextResponse.json({
      transactions,
      matchedCount,
      unmatchedCount,
      totalCount: transactions.length,
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
