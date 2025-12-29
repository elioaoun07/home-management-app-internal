import {
  BudgetContext,
  ChatMessage,
  generateSystemPrompt,
  sendMessageToGemini,
} from "@/lib/ai/gemini";
import { estimateTokens } from "@/lib/ai/tokenUtils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Monthly token limit (Gemini free tier)
const MONTHLY_TOKEN_LIMIT = 1_000_000;

// Rate limiting: Track Gemini API rate limits with exponential backoff
let lastRateLimitError: number = 0;
let rateLimitCooldownMs = 30000; // Start with 30 seconds

function isRateLimited(): { limited: boolean; retryInSeconds: number } {
  if (lastRateLimitError === 0) return { limited: false, retryInSeconds: 0 };
  const elapsed = Date.now() - lastRateLimitError;
  const remaining = rateLimitCooldownMs - elapsed;
  if (remaining <= 0) {
    return { limited: false, retryInSeconds: 0 };
  }
  return { limited: true, retryInSeconds: Math.ceil(remaining / 1000) };
}

function recordRateLimitError(errorMessage: string): number {
  lastRateLimitError = Date.now();

  // Extract retry-after if available from error message
  const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i);
  if (retryMatch) {
    rateLimitCooldownMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 5000; // Add 5s buffer
  } else {
    // Exponential backoff: double the cooldown up to 5 min max
    rateLimitCooldownMs = Math.min(rateLimitCooldownMs * 2, 300000);
  }

  console.log(
    `AI Chat rate limit cooldown set to ${rateLimitCooldownMs / 1000}s`
  );
  return Math.ceil(rateLimitCooldownMs / 1000);
}

interface ChatRequest {
  message: string;
  chatHistory?: ChatMessage[];
  includeContext?: boolean;
  sessionId?: string;
  parentMessageId?: string; // For branching
}

/**
 * POST /api/ai-chat
 * Send a message to the AI assistant with optional budget context
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChatRequest = await req.json();
    const {
      message,
      chatHistory = [],
      includeContext = true,
      sessionId,
      parentMessageId,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Check monthly usage before making request
    const monthlyUsage = await getMonthlyTokenUsage(supabase, user.id);
    if (monthlyUsage >= MONTHLY_TOKEN_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly token limit reached. Please try again next month.",
          usage: {
            used: monthlyUsage,
            limit: MONTHLY_TOKEN_LIMIT,
            percentage: 100,
          },
        },
        { status: 429 }
      );
    }

    // Check if we're in a rate limit cooldown period
    const rateLimitStatus = isRateLimited();
    if (rateLimitStatus.limited) {
      return NextResponse.json(
        {
          error: `AI is temporarily unavailable due to rate limits. Please try again in ${rateLimitStatus.retryInSeconds} seconds.`,
          retryAfter: rateLimitStatus.retryInSeconds,
        },
        { status: 429 }
      );
    }

    // Build budget context if requested
    let budgetContext: BudgetContext | undefined;

    if (includeContext) {
      try {
        budgetContext = await fetchBudgetContext(supabase, user.id);
      } catch (error) {
        console.error("Failed to fetch budget context:", error);
        // Continue without context
      }
    }

    // Convert chat history dates from strings to Date objects
    const formattedHistory: ChatMessage[] = chatHistory.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    // Estimate input tokens before making request
    const systemPrompt = generateSystemPrompt(budgetContext);
    const chatHistoryText = formattedHistory.map((m) => m.content).join(" ");
    const inputTokensEstimate =
      estimateTokens(systemPrompt) +
      estimateTokens(chatHistoryText) +
      estimateTokens(message);

    // Send message to Gemini
    const response = await sendMessageToGemini(
      message,
      formattedHistory,
      budgetContext
    );

    const responseTime = Date.now() - startTime;

    // Estimate output tokens
    const outputTokensEstimate = estimateTokens(response);
    const totalTokensEstimate = inputTokensEstimate + outputTokensEstimate;

    // Log messages to new ai_messages table
    const messageIds = await logMessagesToDatabase(supabase, {
      userId: user.id,
      sessionId: sessionId || `session_${Date.now()}`,
      userMessage: message,
      assistantResponse: response,
      inputTokens: inputTokensEstimate,
      outputTokens: outputTokensEstimate,
      includedBudgetContext: includeContext && !!budgetContext,
      responseTimeMs: responseTime,
      parentMessageId: parentMessageId || null,
    });

    // Calculate updated usage
    const newMonthlyUsage = monthlyUsage + totalTokensEstimate;

    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString(),
      messageIds, // Return the new message IDs for reference
      usage: {
        requestTokens: totalTokensEstimate,
        inputTokens: inputTokensEstimate,
        outputTokens: outputTokensEstimate,
        monthlyUsed: newMonthlyUsage,
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
        monthlyPercentage:
          Math.round((newMonthlyUsage / MONTHLY_TOKEN_LIMIT) * 100 * 10) / 10,
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error("AI Chat error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check for rate limit (429) errors
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED")
    ) {
      // Record the rate limit and get cooldown
      const retrySeconds = recordRateLimitError(errorMessage);

      return NextResponse.json(
        {
          error: `AI is temporarily unavailable due to rate limits. Please try again in ${retrySeconds} seconds.`,
          retryAfter: retrySeconds,
        },
        { status: 429 }
      );
    }

    // Check for API key issues
    if (errorMessage.includes("API key") || errorMessage.includes("401")) {
      return NextResponse.json(
        { error: "AI service not configured. Please check your API key." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to get AI response. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-chat
 * Get chat history and usage stats
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Try new ai_messages table first, fall back to ai_chat_logs
    let messages: Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      input_tokens?: number;
      output_tokens?: number;
      is_edited?: boolean;
    }> = [];

    if (sessionId) {
      // Query from ai_messages table
      const { data: newMessages, error: newError } = await supabase
        .from("ai_messages")
        .select(
          "id, role, content, created_at, input_tokens, output_tokens, is_edited, sequence_num"
        )
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .eq("is_active", true)
        .order("sequence_num", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(limit);

      if (newError) {
        console.error("Failed to fetch messages:", newError);
      } else if (newMessages) {
        messages = newMessages;
      }
    }

    // Get monthly usage (from both tables)
    const monthlyUsage = await getMonthlyTokenUsage(supabase, user.id);

    return NextResponse.json({
      messages,
      // Keep chatHistory for backward compatibility
      chatHistory: messages,
      usage: {
        monthlyUsed: monthlyUsage,
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
        monthlyPercentage:
          Math.round((monthlyUsage / MONTHLY_TOKEN_LIMIT) * 100 * 10) / 10,
        remaining: MONTHLY_TOKEN_LIMIT - monthlyUsage,
      },
    });
  } catch (error) {
    console.error("AI Chat GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai-chat
 * Edit a message or regenerate a response
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, action, newContent } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    if (action === "edit" && newContent) {
      // Get original message
      const { data: original } = await supabase
        .from("ai_messages")
        .select("content")
        .eq("id", messageId)
        .eq("user_id", user.id)
        .single();

      // Update the message
      const { error } = await supabase
        .from("ai_messages")
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
          original_content: original?.content || null,
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to edit message:", error);
        return NextResponse.json(
          { error: "Failed to edit message" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "deactivate") {
      // Mark message and all subsequent messages as inactive (for regeneration)
      const { data: message } = await supabase
        .from("ai_messages")
        .select("session_id, sequence_num")
        .eq("id", messageId)
        .eq("user_id", user.id)
        .single();

      if (message) {
        await supabase
          .from("ai_messages")
          .update({ is_active: false })
          .eq("session_id", message.session_id)
          .eq("user_id", user.id)
          .gte("sequence_num", message.sequence_num);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("AI Chat PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

/**
 * Log messages to the new ai_messages table
 */
async function logMessagesToDatabase(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  data: {
    userId: string;
    sessionId: string;
    userMessage: string;
    assistantResponse: string;
    inputTokens: number;
    outputTokens: number;
    includedBudgetContext: boolean;
    responseTimeMs: number;
    parentMessageId: string | null;
  }
): Promise<{
  userMessageId: string | null;
  assistantMessageId: string | null;
}> {
  try {
    // Ensure session exists
    await supabase.from("ai_sessions").upsert(
      {
        id: data.sessionId,
        user_id: data.userId,
        title:
          data.userMessage.slice(0, 50) +
          (data.userMessage.length > 50 ? "..." : ""),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // Get the next sequence number
    const { data: lastMessage } = await supabase
      .from("ai_messages")
      .select("sequence_num")
      .eq("session_id", data.sessionId)
      .eq("user_id", data.userId)
      .order("sequence_num", { ascending: false })
      .limit(1)
      .single();

    const nextSeq = (lastMessage?.sequence_num || 0) + 1;

    // Insert user message
    const { data: userMsg, error: userError } = await supabase
      .from("ai_messages")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        role: "user",
        content: data.userMessage,
        parent_id: data.parentMessageId,
        sequence_num: nextSeq,
        input_tokens: data.inputTokens,
      })
      .select("id")
      .single();

    if (userError) {
      console.error("Failed to insert user message:", userError);
      return { userMessageId: null, assistantMessageId: null };
    }

    // Insert assistant message
    const { data: assistantMsg, error: assistantError } = await supabase
      .from("ai_messages")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        role: "assistant",
        content: data.assistantResponse,
        parent_id: userMsg.id,
        sequence_num: nextSeq + 1,
        output_tokens: data.outputTokens,
        included_budget_context: data.includedBudgetContext,
        response_time_ms: data.responseTimeMs,
      })
      .select("id")
      .single();

    if (assistantError) {
      console.error("Failed to insert assistant message:", assistantError);
    }

    return {
      userMessageId: userMsg?.id || null,
      assistantMessageId: assistantMsg?.id || null,
    };
  } catch (error) {
    console.error("Failed to log messages:", error);
    return { userMessageId: null, assistantMessageId: null };
  }
}

/**
 * Get monthly token usage for a user (from ai_messages table)
 */
async function getMonthlyTokenUsage(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    // Try using total_tokens column first (if migration applied)
    // Fall back to summing input_tokens + output_tokens
    const { data, error } = await supabase
      .from("ai_messages")
      .select("input_tokens, output_tokens")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gte("created_at", startOfMonth);

    if (error) {
      console.error("Failed to fetch monthly usage:", error);
      return 0;
    }

    // Sum all tokens (input + output) from all messages
    return (data || []).reduce((sum, row) => {
      const input = row.input_tokens || 0;
      const output = row.output_tokens || 0;
      return sum + input + output;
    }, 0);
  } catch (error) {
    console.error("Failed to get monthly usage:", error);
    return 0;
  }
}

/**
 * Fetch budget context for the current user (includes last month data)
 */
async function fetchBudgetContext(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<BudgetContext> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = `${currentMonth}-01`;
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // Calculate last month dates
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthEnd = new Date(
    lastMonthDate.getFullYear(),
    lastMonthDate.getMonth() + 1,
    0
  )
    .toISOString()
    .slice(0, 10);

  // Fetch user's accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("user_id", userId);

  const accountIds = (accounts || []).map((a) => a.id);

  // Separate expense and income account IDs for proper categorization
  const expenseAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "expense").map((a) => a.id)
  );
  const incomeAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "income").map((a) => a.id)
  );

  if (accountIds.length === 0) {
    return {
      totalBudget: 0,
      totalSpent: 0,
      totalRemaining: 0,
      categories: [],
      recentTransactions: [],
      currentMonth,
    };
  }

  // Fetch account balances (try account_balances table first)
  let accountBalances: Record<string, number> = {};
  try {
    const { data: balances } = await supabase
      .from("account_balances")
      .select("account_id, balance")
      .in("account_id", accountIds);

    if (balances) {
      balances.forEach((b) => {
        accountBalances[b.account_id] = b.balance;
      });
    }
  } catch (error) {
    console.warn("Could not fetch account balances:", error);
  }

  const accountsWithBalances = (accounts || []).map((a) => ({
    name: a.name,
    type: a.type,
    balance: accountBalances[a.id] || 0,
  }));

  // Fetch recurring payments
  let recurringPayments: BudgetContext["recurringPayments"] = [];
  try {
    const { data: recurring } = await supabase
      .from("recurring_payments")
      .select("name, amount, recurrence_type, next_due_date")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (recurring) {
      recurringPayments = recurring.map((r) => ({
        name: r.name,
        amount: r.amount,
        recurrence: r.recurrence_type,
        nextDue: r.next_due_date,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch recurring payments:", error);
  }

  // Fetch future purchases
  let futurePurchases: BudgetContext["futurePurchases"] = [];
  try {
    const { data: future } = await supabase
      .from("future_purchases")
      .select("name, target_amount, current_saved, target_date")
      .eq("user_id", userId)
      .neq("status", "cancelled");

    if (future) {
      futurePurchases = future.map((f) => ({
        name: f.name,
        targetAmount: f.target_amount,
        saved: f.current_saved,
        targetDate: f.target_date,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch future purchases:", error);
  }

  // Fetch draft transactions
  let draftTransactions: BudgetContext["draftTransactions"] = [];
  try {
    const { data: drafts } = await supabase
      .from("transactions")
      .select("voice_transcript, confidence_score")
      .eq("user_id", userId)
      .eq("is_draft", true);

    if (drafts) {
      draftTransactions = drafts.map((d) => ({
        transcript: d.voice_transcript || "Unknown draft",
        confidence: d.confidence_score || 0,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch draft transactions:", error);
  }

  // Fetch budget allocations
  const { data: allocations } = await supabase
    .from("budget_allocations")
    .select("monthly_budget, category_id")
    .eq("user_id", userId)
    .or(`budget_month.eq.${currentMonth},budget_month.is.null`);

  // Fetch categories
  const { data: categories } = await supabase
    .from("user_categories")
    .select("id, name")
    .eq("user_id", userId)
    .is("parent_id", null);

  // Fetch current month transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, category_id, description, date, account_id")
    .in("account_id", accountIds)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // Fetch LAST MONTH transactions
  const { data: lastMonthTransactions } = await supabase
    .from("transactions")
    .select("amount, category_id, description, date, account_id")
    .in("account_id", accountIds)
    .gte("date", lastMonthStart)
    .lte("date", lastMonthEnd)
    .order("date", { ascending: false });

  // Separate expense and income transactions (current month)
  const expenseTransactions = (transactions || []).filter((tx) =>
    expenseAccountIds.has(tx.account_id)
  );
  const incomeTransactions = (transactions || []).filter((tx) =>
    incomeAccountIds.has(tx.account_id)
  );

  // Separate expense and income transactions (last month)
  const lastMonthExpenseTransactions = (lastMonthTransactions || []).filter(
    (tx) => expenseAccountIds.has(tx.account_id)
  );
  const lastMonthIncomeTransactions = (lastMonthTransactions || []).filter(
    (tx) => incomeAccountIds.has(tx.account_id)
  );

  // Calculate spending by category (current month - EXPENSES ONLY)
  const categorySpending: Record<string, number> = {};
  expenseTransactions.forEach((tx) => {
    if (tx.category_id) {
      categorySpending[tx.category_id] =
        (categorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

  // Calculate spending by category (last month - EXPENSES ONLY)
  const lastMonthCategorySpending: Record<string, number> = {};
  lastMonthExpenseTransactions.forEach((tx) => {
    if (tx.category_id) {
      lastMonthCategorySpending[tx.category_id] =
        (lastMonthCategorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

  // Calculate total income (current month)
  const totalIncome = incomeTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0
  );

  // Calculate total income (last month)
  const lastMonthTotalIncome = lastMonthIncomeTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0
  );

  // Build category budget info
  const categoryBudgets: Record<string, number> = {};
  (allocations || []).forEach((a) => {
    if (a.category_id) {
      categoryBudgets[a.category_id] =
        (categoryBudgets[a.category_id] || 0) + a.monthly_budget;
    }
  });

  // Create category name mapping
  const categoryNames: Record<string, string> = {};
  (categories || []).forEach((c) => {
    categoryNames[c.id] = c.name;
  });

  // Build categories array (current month)
  const categoriesArray = (categories || []).map((cat) => ({
    name: cat.name,
    budget: categoryBudgets[cat.id] || 0,
    spent: categorySpending[cat.id] || 0,
    remaining: (categoryBudgets[cat.id] || 0) - (categorySpending[cat.id] || 0),
  }));

  // Build last month categories array
  const lastMonthCategoriesArray = (categories || [])
    .filter((cat) => lastMonthCategorySpending[cat.id] > 0)
    .map((cat) => ({
      name: cat.name,
      spent: lastMonthCategorySpending[cat.id] || 0,
    }));

  // Calculate totals (EXPENSES ONLY for spending)
  const totalBudget = categoriesArray.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = categoriesArray.reduce((sum, c) => sum + c.spent, 0);
  const lastMonthTotalSpent = lastMonthCategoriesArray.reduce(
    (sum, c) => sum + c.spent,
    0
  );

  // Format recent transactions (current month - EXPENSES ONLY with clear labeling)
  const recentExpenseTransactions = expenseTransactions
    .slice(0, 10)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Uncategorized",
      date: tx.date,
    }));

  // Format recent income transactions (current month)
  const recentIncomeTransactions = incomeTransactions.slice(0, 5).map((tx) => ({
    description: tx.description || "Unknown",
    amount: tx.amount,
    category: categoryNames[tx.category_id] || "Income",
    date: tx.date,
  }));

  // Format last month transactions (EXPENSES ONLY)
  const lastMonthFormattedTransactions = lastMonthExpenseTransactions
    .slice(0, 15)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Uncategorized",
      date: tx.date,
    }));

  // Format last month income transactions
  const lastMonthFormattedIncomeTransactions = lastMonthIncomeTransactions
    .slice(0, 5)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Income",
      date: tx.date,
    }));

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    categories: categoriesArray,
    recentTransactions: recentExpenseTransactions,
    currentMonth,
    // Include income data
    totalIncome,
    recentIncomeTransactions,
    // Include last month data
    lastMonth: {
      month: lastMonth,
      totalSpent: lastMonthTotalSpent,
      totalIncome: lastMonthTotalIncome,
      categories: lastMonthCategoriesArray,
      transactions: lastMonthFormattedTransactions,
      incomeTransactions: lastMonthFormattedIncomeTransactions,
    },
    recurringPayments,
    futurePurchases,
    accounts: accountsWithBalances,
    draftTransactions,
  };
}
