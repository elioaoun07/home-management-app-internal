import { generateContentWithFallback } from "@/lib/ai/gemini";
import {
  aggregateCleanMonthlyByCategory,
  buildStatisticalSuggestion,
  computeCategoryBaselines,
  softClampSuggestions,
  type ForecastTransaction,
} from "@/lib/budget/budgetForecast";
import { supabaseServer } from "@/lib/supabase/server";
import type { RecurringHint } from "@/lib/utils/anomalyDetection";
import type {
  AiBudgetSuggestion,
  AiCategorySuggestion,
  BudgetWeek,
} from "@/types/budgetAllocation";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_WEEKS: BudgetWeek[] = ["w0", "w1", "w2", "w3", "w4"];

// ===== GET — fetch stored AI suggestion for a month+week =====
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  const week = req.nextUrl.searchParams.get("week") as BudgetWeek | null;

  if (!month || !week || !VALID_WEEKS.includes(week)) {
    return NextResponse.json(
      { error: "Missing or invalid month/week" },
      { status: 400 },
    );
  }

  // Fetch single suggestion
  const { data, error } = await supabase
    .from("ai_budget_suggestions")
    .select("*")
    .eq("user_id", user.id)
    .eq("budget_month", month)
    .eq("week", week)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch which weeks have suggestions (for indicators)
  const { data: weekRows } = await supabase
    .from("ai_budget_suggestions")
    .select("week")
    .eq("user_id", user.id)
    .eq("budget_month", month);

  const weeksWithSuggestions = (weekRows || []).map((r) => r.week);

  return NextResponse.json({
    suggestion: data as AiBudgetSuggestion | null,
    weeksWithSuggestions,
  });
}

// ===== POST — generate and save AI budget suggestion =====
const postSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  week: z.enum(["w0", "w1", "w2", "w3", "w4"]),
  force: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { month, week, force } = parsed.data;

  // Check if suggestion already exists
  const { data: existing } = await supabase
    .from("ai_budget_suggestions")
    .select("*")
    .eq("user_id", user.id)
    .eq("budget_month", month)
    .eq("week", week)
    .maybeSingle();

  if (existing && !force) {
    return NextResponse.json(
      {
        exists: true,
        suggestion: existing as AiBudgetSuggestion,
      },
      { status: 200 },
    );
  }

  // If force, delete old row
  if (existing) {
    await supabase.from("ai_budget_suggestions").delete().eq("id", existing.id);
  }

  // --- Gather context ---
  // Household link
  const { data: householdLink } = await supabase
    .from("household_links")
    .select("*")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .single();

  const partnerId = householdLink
    ? householdLink.owner_user_id === user.id
      ? householdLink.partner_user_id
      : householdLink.owner_user_id
    : null;
  const userIds = partnerId ? [user.id, partnerId] : [user.id];

  // Accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type, user_id")
    .in("user_id", userIds);

  const expenseAccounts = (accounts || []).filter((a) => a.type === "expense");
  const expenseAccountIds = expenseAccounts.map((a) => a.id);

  // Wallet balance
  const walletAccounts = expenseAccounts.filter((a) =>
    a.name.toLowerCase().includes("wallet"),
  );
  let walletBalance = 0;
  if (walletAccounts.length > 0) {
    const { data: walletBals } = await supabase
      .from("account_balances")
      .select("account_id, balance")
      .in(
        "account_id",
        walletAccounts.map((a) => a.id),
      );
    walletBalance = (walletBals || []).reduce(
      (s, b) => s + Number(b.balance),
      0,
    );
  }

  // Categories & subcategories
  const { data: allCategories } = await supabase
    .from("user_categories")
    .select("id, name, color, parent_id, account_id, position")
    .in("user_id", userIds)
    .eq("visible", true)
    .in("account_id", expenseAccountIds)
    .order("position", { ascending: true });

  const rootCats = (allCategories || []).filter((c) => !c.parent_id);
  const subCats = (allCategories || []).filter((c) => c.parent_id);

  // Build category name map (merge across accounts)
  type MergedCat = {
    name: string;
    ids: string[];
    color: string;
    subcategories: { name: string; ids: string[] }[];
  };
  const catMap = new Map<string, MergedCat>();
  for (const c of rootCats) {
    const existing = catMap.get(c.name);
    if (existing) {
      existing.ids.push(c.id);
    } else {
      catMap.set(c.name, {
        name: c.name,
        ids: [c.id],
        color: c.color || "#38bdf8",
        subcategories: [],
      });
    }
  }
  const catIdToName: Record<string, string> = {};
  for (const c of allCategories || []) catIdToName[c.id] = c.name;

  for (const sub of subCats) {
    const parentName = catIdToName[sub.parent_id!];
    if (!parentName) continue;
    const parent = catMap.get(parentName);
    if (!parent) continue;
    const existingSub = parent.subcategories.find((s) => s.name === sub.name);
    if (existingSub) existingSub.ids.push(sub.id);
    else parent.subcategories.push({ name: sub.name, ids: [sub.id] });
  }

  // 12 months of transaction history
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const historyStart = twelveMonthsAgo.toISOString().slice(0, 10);

  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      "id, amount, category_id, subcategory_id, user_id, date, description",
    )
    .in("account_id", expenseAccountIds)
    .gte("date", historyStart)
    .order("date", { ascending: false });

  // Recurring payments (fixed-obligation context + hints so legitimate
  // recurring charges are never mistaken for spending outliers).
  const { data: recurring } = await supabase
    .from("recurring_payments")
    .select("name, amount, recurrence_type, next_due_date")
    .in("account_id", expenseAccountIds)
    .eq("is_active", true);

  const recurringHints: RecurringHint[] = (recurring || []).map((r) => ({
    name: r.name,
    amount: Number(r.amount),
  }));

  // Resolve each transaction to its leaf spend bucket, then aggregate into
  // monthly per-category spend with statistical one-off outliers stripped out
  // so a single large purchase can't inflate a category's baseline.
  const forecastTxs: ForecastTransaction[] = [];
  for (const tx of transactions || []) {
    const catId = tx.subcategory_id || tx.category_id;
    const catName = catId ? catIdToName[catId] : null;
    if (!catName) continue;
    forecastTxs.push({
      id: tx.id,
      amount: tx.amount,
      category: catName,
      description: tx.description,
      date: tx.date,
    });
  }

  const cleaned = aggregateCleanMonthlyByCategory(forecastTxs, recurringHints);
  const monthlyData = cleaned.monthly;
  const excludedOutlierCount = cleaned.excludedCount;

  // Current month spending (raw — this is "spent so far", not the baseline)
  const currentMonthSpending: Record<string, number> = {};
  for (const tx of transactions || []) {
    if (tx.date.slice(0, 7) !== month) continue;
    const catId = tx.subcategory_id || tx.category_id;
    const catName = catId ? catIdToName[catId] : null;
    if (!catName) continue;
    currentMonthSpending[catName] =
      (currentMonthSpending[catName] || 0) + tx.amount;
  }

  // Current manual budget allocations
  const { data: manualAllocations } = await supabase
    .from("budget_allocations")
    .select("category_id, subcategory_id, monthly_budget")
    .eq("user_id", user.id)
    .or(`budget_month.eq.${month},budget_month.is.null`);

  // Previous week's AI suggestion (for w1–w4)
  let previousSuggestion: AiCategorySuggestion[] | null = null;
  const weekIndex = parseInt(week.slice(1));
  if (weekIndex > 0) {
    const prevWeek = `w${weekIndex - 1}` as BudgetWeek;
    const { data: prevRow } = await supabase
      .from("ai_budget_suggestions")
      .select("suggestions")
      .eq("user_id", user.id)
      .eq("budget_month", month)
      .eq("week", prevWeek)
      .maybeSingle();
    if (prevRow)
      previousSuggestion = prevRow.suggestions as AiCategorySuggestion[];
  }

  // --- Build prompt ---
  const categoryList = Array.from(catMap.values()).map((c) => ({
    name: c.name,
    primaryId: c.ids[0],
    subcategories: c.subcategories.map((s) => ({
      name: s.name,
      primaryId: s.ids[0],
    })),
  }));

  const monthLabels = Object.keys(monthlyData).sort().reverse();

  const monthlyBreakdown = monthLabels
    .map((m) => {
      const spend = monthlyData[m];
      const entries = Object.entries(spend)
        .sort(([, a], [, b]) => b - a)
        .map(([name, amt]) => `  - ${name}: $${amt.toFixed(2)}`)
        .join("\n");
      const total = Object.values(spend).reduce((s, v) => s + v, 0);
      return `Month ${m} (Total: $${total.toFixed(2)}):\n${entries}`;
    })
    .join("\n\n");

  const recurringText =
    (recurring || []).length > 0
      ? (recurring || [])
          .map(
            (r) =>
              `- ${r.name}: $${r.amount} (${r.recurrence_type}, next: ${r.next_due_date})`,
          )
          .join("\n")
      : "None";

  const currentSpendText =
    Object.keys(currentMonthSpending).length > 0
      ? Object.entries(currentMonthSpending)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amt]) => `- ${name}: $${amt.toFixed(2)}`)
          .join("\n")
      : "No spending yet this month";

  const manualBudgetText =
    (manualAllocations || []).length > 0
      ? (manualAllocations || [])
          .map((a) => {
            const catName = catIdToName[a.category_id] || "Unknown";
            const subName = a.subcategory_id
              ? catIdToName[a.subcategory_id]
              : null;
            return `- ${catName}${subName ? ` > ${subName}` : ""}: $${a.monthly_budget}`;
          })
          .join("\n")
      : "No manual allocations set";

  const prevSuggestionText = previousSuggestion
    ? previousSuggestion
        .map(
          (s) =>
            `- ${s.category_name}: $${s.suggested_budget}${
              s.subcategories?.length
                ? ` (${s.subcategories.map((sc) => `${sc.subcategory_name}: ${sc.percentage}%`).join(", ")})`
                : ""
            }`,
        )
        .join("\n")
    : null;

  const weekLabel =
    week === "w0" ? "Initial (start of month)" : `Week ${weekIndex} review`;

  const systemPrompt = `You are an expert budget analyst. Analyze the provided financial data and suggest optimal budget allocations.

CONSTRAINTS:
- Total suggested budget MUST NOT exceed the wallet balance of $${walletBalance.toFixed(2)}
- You MUST suggest budgets for ALL categories listed below
- Each category budget must be >= 0
- For categories with subcategories, distribute the budget using percentages that sum to 100%
- Base your suggestions on historical spending patterns, recurring obligations, and seasonal trends
- Consider the current week stage: ${weekLabel}
${week !== "w0" ? "- For weekly reviews, adjust based on actual spending so far this month and whether the user is on track" : "- For initial allocation, set a balanced plan based on historical patterns"}

AVAILABLE CATEGORIES:
${categoryList
  .map(
    (c) =>
      `- ${c.name} (id: ${c.primaryId})${
        c.subcategories.length > 0
          ? `\n  Subcategories: ${c.subcategories.map((s) => `${s.name} (id: ${s.primaryId})`).join(", ")}`
          : ""
      }`,
  )
  .join("\n")}

WALLET BALANCE (available budget): $${walletBalance.toFixed(2)}

CURRENT MONTH (${month}) SPENDING SO FAR:
${currentSpendText}

CURRENT MANUAL BUDGET ALLOCATIONS:
${manualBudgetText}

RECURRING PAYMENTS (fixed obligations):
${recurringText}

${prevSuggestionText ? `PREVIOUS WEEK'S AI SUGGESTION:\n${prevSuggestionText}\n` : ""}
HISTORICAL SPENDING (last 12 months, one-off outliers excluded):
${monthlyBreakdown}

RESPOND WITH ONLY valid JSON — no markdown, no explanation outside the JSON. Use this exact format:
{
  "suggestions": [
    {
      "category_id": "uuid",
      "category_name": "Name",
      "suggested_budget": 123.45,
      "reasoning": "Brief explanation",
      "subcategories": [
        { "subcategory_id": "uuid", "subcategory_name": "Name", "percentage": 50, "suggested_amount": 61.72 }
      ]
    }
  ],
  "total_suggested": 300.00,
  "summary": "Brief overall strategy summary"
}`;

  // --- Generate suggestion: AI when available, statistical fallback otherwise ---
  // `categoryList` already matches the ForecastCategory shape.
  const baselines = computeCategoryBaselines(categoryList, monthlyData);

  let aiResult: {
    suggestions: AiCategorySuggestion[];
    total_suggested?: number;
    summary?: string;
  } | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await generateContentWithFallback({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Generate the budget suggestion based on the analysis above.",
              },
            ],
          },
        ],
        systemInstruction: systemPrompt,
        config: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (text) {
        try {
          aiResult = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) aiResult = JSON.parse(jsonMatch[1].trim());
        }
      }
    } catch {
      // Swallow and fall back to the deterministic estimate below.
      aiResult = null;
    }
  }

  let finalSuggestions: AiCategorySuggestion[];
  let summary: string;
  let generationMethod: "ai" | "estimate";

  if (
    aiResult &&
    Array.isArray(aiResult.suggestions) &&
    aiResult.suggestions.length > 0
  ) {
    // Anchor the AI's numbers to each category's typical (outlier-free) spend.
    finalSuggestions = softClampSuggestions(aiResult.suggestions, baselines);
    summary =
      aiResult.summary?.trim() ||
      "AI-generated allocation based on your spending history.";
    generationMethod = "ai";
  } else {
    const fallback = buildStatisticalSuggestion(
      categoryList,
      monthlyData,
      walletBalance,
    );
    finalSuggestions = fallback.suggestions;
    summary = fallback.summary;
    generationMethod = "estimate";
  }

  // Clamp the plan total to the wallet balance (scale down proportionally).
  const totalSuggested = finalSuggestions.reduce(
    (s, c) => s + c.suggested_budget,
    0,
  );
  if (totalSuggested > walletBalance && walletBalance > 0) {
    const ratio = walletBalance / totalSuggested;
    for (const s of finalSuggestions) {
      s.suggested_budget = Math.round(s.suggested_budget * ratio * 100) / 100;
      if (s.subcategories) {
        for (const sc of s.subcategories) {
          sc.suggested_amount =
            Math.round((sc.percentage / 100) * s.suggested_budget * 100) / 100;
        }
      }
    }
  }

  const finalTotal = finalSuggestions.reduce(
    (s, c) => s + c.suggested_budget,
    0,
  );

  const { data: saved, error: saveError } = await supabase
    .from("ai_budget_suggestions")
    .insert({
      user_id: user.id,
      budget_month: month,
      week,
      suggestions: finalSuggestions,
      wallet_balance_used: walletBalance,
      total_suggested: Math.round(finalTotal * 100) / 100,
      summary,
      generation_method: generationMethod,
      excluded_outlier_count: excludedOutlierCount,
    })
    .select()
    .single();

  if (saveError) {
    if ((saveError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Suggestion already exists for this week" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json(
    { suggestion: saved as AiBudgetSuggestion, generated: true },
    { status: 201 },
  );
}
