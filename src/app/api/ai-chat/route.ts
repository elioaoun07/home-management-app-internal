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

interface ChatRequest {
  message: string;
  chatHistory?: ChatMessage[];
  includeContext?: boolean;
  sessionId?: string;
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

    // Log the conversation to database
    await logChatToDatabase(supabase, {
      userId: user.id,
      userMessage: message,
      assistantResponse: response,
      inputTokens: inputTokensEstimate,
      outputTokens: outputTokensEstimate,
      includedBudgetContext: includeContext && !!budgetContext,
      sessionId: sessionId || null,
      responseTimeMs: responseTime,
    });

    // Calculate updated usage
    const newMonthlyUsage = monthlyUsage + totalTokensEstimate;

    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString(),
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
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get chat history
    let query = supabase
      .from("ai_chat_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: chatHistory, error } = await query;

    if (error) {
      console.error("Failed to fetch chat history:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      );
    }

    // Get monthly usage
    const monthlyUsage = await getMonthlyTokenUsage(supabase, user.id);

    return NextResponse.json({
      chatHistory: chatHistory || [],
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
 * Log chat conversation to database
 */
async function logChatToDatabase(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  data: {
    userId: string;
    userMessage: string;
    assistantResponse: string;
    inputTokens: number;
    outputTokens: number;
    includedBudgetContext: boolean;
    sessionId: string | null;
    responseTimeMs: number;
  }
) {
  try {
    const { error } = await supabase.from("ai_chat_logs").insert({
      user_id: data.userId,
      user_message: data.userMessage,
      assistant_response: data.assistantResponse,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      included_budget_context: data.includedBudgetContext,
      session_id: data.sessionId,
      response_time_ms: data.responseTimeMs,
    });

    if (error) {
      console.error("Failed to log chat to database:", error);
      // Don't throw - logging failure shouldn't break the chat
    }
  } catch (error) {
    console.error("Failed to log chat:", error);
  }
}

/**
 * Get monthly token usage for a user
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

    const { data, error } = await supabase
      .from("ai_chat_logs")
      .select("input_tokens, output_tokens")
      .eq("user_id", userId)
      .gte("created_at", startOfMonth);

    if (error) {
      console.error("Failed to fetch monthly usage:", error);
      return 0;
    }

    return (data || []).reduce(
      (sum, row) => sum + (row.input_tokens || 0) + (row.output_tokens || 0),
      0
    );
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
    .select("id")
    .eq("user_id", userId);

  const accountIds = (accounts || []).map((a) => a.id);

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
    .select("amount, category_id, description, date")
    .in("account_id", accountIds)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // Fetch LAST MONTH transactions
  const { data: lastMonthTransactions } = await supabase
    .from("transactions")
    .select("amount, category_id, description, date")
    .in("account_id", accountIds)
    .gte("date", lastMonthStart)
    .lte("date", lastMonthEnd)
    .order("date", { ascending: false });

  // Calculate spending by category (current month)
  const categorySpending: Record<string, number> = {};
  (transactions || []).forEach((tx) => {
    if (tx.category_id) {
      categorySpending[tx.category_id] =
        (categorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

  // Calculate spending by category (last month)
  const lastMonthCategorySpending: Record<string, number> = {};
  (lastMonthTransactions || []).forEach((tx) => {
    if (tx.category_id) {
      lastMonthCategorySpending[tx.category_id] =
        (lastMonthCategorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

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

  // Calculate totals
  const totalBudget = categoriesArray.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = categoriesArray.reduce((sum, c) => sum + c.spent, 0);
  const lastMonthTotalSpent = lastMonthCategoriesArray.reduce(
    (sum, c) => sum + c.spent,
    0
  );

  // Format recent transactions (current month)
  const recentTransactions = (transactions || []).slice(0, 10).map((tx) => ({
    description: tx.description || "Unknown",
    amount: tx.amount,
    category: categoryNames[tx.category_id] || "Uncategorized",
    date: tx.date,
  }));

  // Format last month transactions
  const lastMonthFormattedTransactions = (lastMonthTransactions || [])
    .slice(0, 15)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Uncategorized",
      date: tx.date,
    }));

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    categories: categoriesArray,
    recentTransactions,
    currentMonth,
    // Include last month data
    lastMonth: {
      month: lastMonth,
      totalSpent: lastMonthTotalSpent,
      categories: lastMonthCategoriesArray,
      transactions: lastMonthFormattedTransactions,
    },
  };
}
