// src/app/api/statement-import/import/route.ts
// Import parsed transactions into the database

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
    const body = await req.json();
    const { transactions, file_name } = body;

    if (
      !transactions ||
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      return NextResponse.json(
        { error: "No transactions to import" },
        { status: 400 }
      );
    }

    // Validate all transactions have required fields
    for (const t of transactions) {
      if (!t.date || !t.account_id || t.amount === undefined) {
        return NextResponse.json(
          { error: "All transactions must have date, amount, and account_id" },
          { status: 400 }
        );
      }
    }

    // Start import
    const importedTransactions = [];
    const merchantMappingsToSave = [];

    for (const t of transactions) {
      // Insert transaction
      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          date: t.date,
          amount: Math.abs(t.amount),
          description: t.description || "",
          account_id: t.account_id,
          category_id: t.category_id || null,
          subcategory_id: t.subcategory_id || null,
          is_draft: false,
          is_imported: true, // Mark as imported from bank statement
        })
        .select()
        .single();

      if (txnError) {
        console.error("Failed to insert transaction:", txnError);
        continue;
      }

      importedTransactions.push(txn);

      // Save merchant mapping if requested
      if (t.save_merchant_mapping && t.merchant_pattern && t.merchant_name) {
        merchantMappingsToSave.push({
          user_id: user.id,
          merchant_pattern: t.merchant_pattern.toUpperCase().trim(),
          merchant_name: t.merchant_name.trim(),
          category_id: t.category_id || null,
          subcategory_id: t.subcategory_id || null,
          account_id: t.account_id,
        });
      }
    }

    // Save new merchant mappings (upsert to handle duplicates)
    if (merchantMappingsToSave.length > 0) {
      const uniqueMappings = new Map();
      for (const m of merchantMappingsToSave) {
        uniqueMappings.set(m.merchant_pattern, m);
      }

      for (const mapping of uniqueMappings.values()) {
        await supabase.from("merchant_mappings").upsert(mapping, {
          onConflict: "user_id,merchant_pattern",
        });
      }
    }

    // Record the import
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      file_name: file_name || "Unknown",
      transactions_count: importedTransactions.length,
      status: "completed",
    });

    // Update use_count for matched merchants
    // This helps prioritize frequently used merchants
    const matchedPatterns = transactions
      .filter((t: any) => t.matched && t.merchant_pattern)
      .map((t: any) => t.merchant_pattern.toUpperCase());

    if (matchedPatterns.length > 0) {
      // Increment use_count for each matched pattern
      for (const pattern of new Set(matchedPatterns)) {
        await supabase.rpc("increment_merchant_use_count", {
          p_user_id: user.id,
          p_pattern: pattern,
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported_count: importedTransactions.length,
      merchant_mappings_saved: merchantMappingsToSave.length,
    });
  } catch (error) {
    console.error("Failed to import transactions:", error);
    return NextResponse.json(
      { error: "Failed to import transactions" },
      { status: 500 }
    );
  }
}
