// src/app/api/statement-import/import/route.ts
// Import parsed transactions into the database

import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import { getBalanceDelta } from "@/lib/balance-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function statementHashRoot(hash: string) {
  return hash.replace(/:split:\d+$/, "");
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
    const body = await req.json();
    const { transactions, file_name } = body;

    if (
      !transactions ||
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      return NextResponse.json(
        { error: "No transactions to import" },
        { status: 400 },
      );
    }

    // Validate all transactions have required fields
    for (const t of transactions) {
      if (!t.date || !t.account_id || t.amount === undefined) {
        return NextResponse.json(
          { error: "All transactions must have date, amount, and account_id" },
          { status: 400 },
        );
      }
    }

    // Start import
    const importedTransactions = [];
    const merchantMappingsToSave = [];
    const accountDeductions: Record<string, number> = {}; // Track deductions per account
    let skippedCount = 0; // Duplicate rows from re-uploading the same statement
    const statementHashes = [
      ...new Set(
        transactions
          .map((t: any) => t.statement_hash)
          .filter(
            (hash: unknown): hash is string =>
              typeof hash === "string" && hash.length > 0,
          ),
      ),
    ];
    const existingStatementHashes = new Set<string>();
    const existingStatementRoots = new Set<string>();

    if (statementHashes.length > 0) {
      const rootHashes = [...new Set(statementHashes.map(statementHashRoot))];
      const { data: existingRows } = await supabase
        .from("transactions")
        .select("statement_hash")
        .eq("user_id", user.id)
        .in("statement_hash", [
          ...new Set([...statementHashes, ...rootHashes]),
        ]);

      for (const row of existingRows || []) {
        if (row.statement_hash) {
          existingStatementHashes.add(row.statement_hash);
          existingStatementRoots.add(statementHashRoot(row.statement_hash));
        }
      }

      for (const rootHash of rootHashes) {
        const { data: splitRows } = await supabase
          .from("transactions")
          .select("statement_hash")
          .eq("user_id", user.id)
          .like("statement_hash", `${rootHash}:split:%`)
          .limit(1);

        if (splitRows?.length) existingStatementRoots.add(rootHash);
      }
    }
    const skippedHashes = new Set<string>();
    const skippedRoots = new Set<string>();

    for (const t of transactions) {
      const hashRoot = t.statement_hash
        ? statementHashRoot(t.statement_hash)
        : null;
      const alreadyImported =
        !!t.statement_hash &&
        (existingStatementHashes.has(t.statement_hash) ||
          (hashRoot ? existingStatementRoots.has(hashRoot) : false));

      if (alreadyImported) {
        if (hashRoot && !skippedRoots.has(hashRoot)) {
          skippedCount++;
          skippedRoots.add(hashRoot);
        } else if (!hashRoot && !skippedHashes.has(t.statement_hash)) {
          skippedCount++;
          skippedHashes.add(t.statement_hash);
        }
        continue;
      }

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
          statement_hash: t.statement_hash || null,
        })
        .select()
        .single();

      if (txnError) {
        // 23505 = unique_violation — this row already exists (duplicate import)
        if ((txnError as any).code === "23505") {
          if (hashRoot && !skippedRoots.has(hashRoot)) {
            skippedCount++;
            skippedRoots.add(hashRoot);
          } else if (
            !t.statement_hash ||
            !skippedHashes.has(t.statement_hash)
          ) {
            skippedCount++;
            if (t.statement_hash) skippedHashes.add(t.statement_hash);
          }
          continue;
        }
        continue;
      }

      importedTransactions.push(txn);

      // Track balance deduction for this account
      const amount = Math.abs(t.amount);
      accountDeductions[t.account_id] =
        (accountDeductions[t.account_id] || 0) + amount;

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

    // Fetch account types for all affected accounts
    const affectedAccountIds = Object.keys(accountDeductions);
    const { data: affectedAccounts } = await supabase
      .from("accounts")
      .select("id, type")
      .in("id", affectedAccountIds);

    const accountTypeMap: Record<string, AccountType> = {};
    for (const acc of affectedAccounts || []) {
      accountTypeMap[acc.id] = acc.type as AccountType;
    }

    // Update balances using proper delta calculation per account type
    for (const [accountId, totalDeduction] of Object.entries(
      accountDeductions,
    )) {
      const accountType = accountTypeMap[accountId] || "expense";
      const delta = getBalanceDelta(
        totalDeduction,
        accountType,
        false,
        "create",
      );
      await adjustAccountBalance(accountId, delta, "statement_import", {
        userId: user.id,
        reason: `Statement import: ${file_name || "Unknown"}`,
      });
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
      skipped_count: skippedCount,
      merchant_mappings_saved: merchantMappingsToSave.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to import transactions" },
      { status: 500 },
    );
  }
}
