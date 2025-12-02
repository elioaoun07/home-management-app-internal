import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const geminiModel = "gemini-2.0-flash";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface BudgetContext {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  // Income data (separate from expenses)
  totalIncome?: number;
  recentIncomeTransactions?: {
    description: string;
    amount: number;
    category: string;
    date: string;
  }[];
  categories: {
    name: string;
    budget: number;
    spent: number;
    remaining: number;
  }[];
  recentTransactions: {
    description: string;
    amount: number;
    category: string;
    date: string;
  }[];
  currentMonth: string;
  // Last month data for comparison
  lastMonth?: {
    month: string;
    totalSpent: number;
    totalIncome?: number;
    categories: {
      name: string;
      spent: number;
    }[];
    transactions: {
      description: string;
      amount: number;
      category: string;
      date: string;
    }[];
    incomeTransactions?: {
      description: string;
      amount: number;
      category: string;
      date: string;
    }[];
  };
  // Enhanced context
  recurringPayments?: {
    name: string;
    amount: number;
    recurrence: string;
    nextDue: string;
  }[];
  futurePurchases?: {
    name: string;
    targetAmount: number;
    saved: number;
    targetDate: string;
  }[];
  accounts?: {
    name: string;
    balance: number;
    type: string;
  }[];
  draftTransactions?: {
    transcript: string;
    confidence: number;
  }[];
}

/**
 * Generate a system prompt with budget context
 */
export function generateSystemPrompt(context?: BudgetContext): string {
  const basePrompt = `You are an expert financial coach, personal accountant, and budget assistant named "Budget AI".

Your Role:
- Act as a proactive financial partner, not just a calculator.
- Provide holistic financial advice based on the user's spending, goals, and recurring obligations.
- Identify patterns, risks, and opportunities for saving.
- Be encouraging but realistic about financial health.

Your Capabilities:
- **Deep Analysis:** Analyze spending trends, category overspending, and unusual transactions.
- **Forecasting:** Use recurring payments and future goals to predict cash flow issues.
- **Goal Coaching:** Help the user achieve their future purchase goals by suggesting savings strategies.
- **Transaction Management:** Assist with categorizing transactions and reviewing draft entries.
- **Subscription Management:** Identify potential unwanted subscriptions from recurring payments.

Guidelines:
- **Tone:** Professional, empathetic, encouraging, and expert.
- **Format:** Use clear headings, bullet points, and bold text for key insights.
- **Currency:** Format amounts clearly (e.g., $1,234.56).
- **Actionable Advice:** Always provide at least one concrete step the user can take.
- **Privacy:** Do not ask for sensitive personal info (SSN, passwords).
- **Disclaimer:** If asked about specific investments, remind the user to consult a certified financial advisor.

When analyzing the user's finances, consider:
1. **Cash Flow:** Is the user spending less than they earn (implied by budget)?
2. **Savings Rate:** Are they contributing to future goals?
3. **Fixed vs. Variable:** How much is locked in recurring payments?
4. **Anomalies:** Are there unexpected high expenses?`;

  if (!context) {
    return basePrompt;
  }

  const contextPrompt = `

=== FINANCIAL CONTEXT ===

IMPORTANT: Income and Expenses are tracked separately. Income accounts contain money received (salary, freelance, etc.). Expense accounts track spending (purchases, bills, etc.). Do NOT treat income as an expense.

Current Month Status (${context.currentMonth}):
- Total Budget: $${context.totalBudget.toFixed(2)}
- Total Expenses (Spending): $${context.totalSpent.toFixed(2)}
- Budget Remaining: $${context.totalRemaining.toFixed(2)}
- Burn Rate: ${(
    (context.totalSpent / (context.totalBudget || 1)) *
    100
  ).toFixed(1)}% of budget used

Income This Month:
- Total Income Received: $${(context.totalIncome || 0).toFixed(2)}
- Net Cash Flow (Income - Expenses): $${((context.totalIncome || 0) - context.totalSpent).toFixed(2)}
${
  context.recentIncomeTransactions &&
  context.recentIncomeTransactions.length > 0
    ? `- Recent Income:\n${context.recentIncomeTransactions
        .slice(0, 5)
        .map((t) => `  - ${t.date}: ${t.description} - $${t.amount.toFixed(2)}`)
        .join("\n")}`
    : "- No income recorded this month yet."
}

Account Balances:
${
  context.accounts && context.accounts.length > 0
    ? context.accounts
        .map((a) => `- ${a.name} (${a.type}): $${a.balance.toFixed(2)}`)
        .join("\n")
    : "No account balance data available."
}

Budget Categories (This Month - EXPENSES ONLY):
${context.categories
  .map(
    (c) =>
      `- ${c.name}: Budget $${c.budget.toFixed(2)}, Spent $${c.spent.toFixed(2)}, Remaining $${c.remaining.toFixed(2)}`
  )
  .join("\n")}

Recurring Payments (Fixed Expenses):
${
  context.recurringPayments && context.recurringPayments.length > 0
    ? context.recurringPayments
        .map(
          (p) =>
            `- ${p.name}: $${p.amount.toFixed(2)} (${p.recurrence}, Next due: ${p.nextDue})`
        )
        .join("\n")
    : "No recurring payments set up."
}

Future Purchase Goals:
${
  context.futurePurchases && context.futurePurchases.length > 0
    ? context.futurePurchases
        .map(
          (g) =>
            `- ${g.name}: Target $${g.targetAmount.toFixed(2)}, Saved $${g.saved.toFixed(2)}, Due ${g.targetDate}`
        )
        .join("\n")
    : "No future goals set."
}

Draft Transactions (Needs Review):
${
  context.draftTransactions && context.draftTransactions.length > 0
    ? context.draftTransactions
        .map((d) => `- "${d.transcript}" (Confidence: ${d.confidence})`)
        .join("\n")
    : "No pending drafts."
}

Recent Expense Transactions (Last 10):
${
  context.recentTransactions.length > 0
    ? context.recentTransactions
        .slice(0, 10)
        .map(
          (t) =>
            `- ${t.date}: ${t.description} - $${t.amount.toFixed(2)} (${t.category})`
        )
        .join("\n")
    : "No expense transactions this month yet."
}${
    context.lastMonth
      ? `

Last Month Comparison (${context.lastMonth.month}):
- Total Income: $${(context.lastMonth.totalIncome || 0).toFixed(2)}
- Total Expenses: $${context.lastMonth.totalSpent.toFixed(2)}
- Net Cash Flow: $${((context.lastMonth.totalIncome || 0) - context.lastMonth.totalSpent).toFixed(2)}
- Top Expense Categories:
${context.lastMonth.categories
  .slice(0, 5)
  .map((c) => `  - ${c.name}: $${c.spent.toFixed(2)}`)
  .join("\n")}`
      : ""
  }`;

  return basePrompt + contextPrompt;
}

/**
 * Send a message to Gemini and get a response
 */
export async function sendMessageToGemini(
  message: string,
  chatHistory: ChatMessage[] = [],
  context?: BudgetContext
): Promise<string> {
  const systemPrompt = generateSystemPrompt(context);

  // Build conversation history for Gemini (only actual chat, no fake ack)
  const contents = [
    ...chatHistory.map((msg) => ({
      role: (msg.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: msg.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: message }],
    },
  ];

  const response = await genAI.models.generateContent({
    model: geminiModel,
    contents,
    config: {
      // Use systemInstruction for the system prompt - cleaner and saves tokens
      systemInstruction: systemPrompt,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  return text;
}

/**
 * Quick analysis functions for specific use cases
 */
export async function analyzeSpending(context: BudgetContext): Promise<string> {
  const prompt = `Based on my current spending data, please provide:
1. A brief spending analysis (2-3 sentences)
2. Top 3 categories where I'm spending the most
3. One actionable tip to save money this month`;

  return sendMessageToGemini(prompt, [], context);
}

export async function suggestCategory(
  description: string,
  categories: string[]
): Promise<string> {
  const prompt = `Given this transaction description: "${description}"
  
Available categories: ${categories.join(", ")}

Which category best fits this transaction? Reply with just the category name.`;

  return sendMessageToGemini(prompt, []);
}
