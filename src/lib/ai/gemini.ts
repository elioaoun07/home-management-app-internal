import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
// Fallback model has a separate quota bucket from the primary, so when the
// primary 429s we transparently retry on the fallback before surfacing the
// rate limit to the user. See ERA Notes/03 - Junction Modules/AI Assistant.
export const geminiFallbackModel =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.0-flash-lite";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Detect Gemini 429 / quota-exhausted errors. */
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit")
  );
}

/**
 * Parse `retryDelay` (e.g. "27s", "1.5s") from a Gemini RESOURCE_EXHAUSTED
 * error body. Returns ms, capped to a sane upper bound.
 */
function parseRetryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  // The SDK stringifies the JSON error body into the message, so a regex match
  // is the most reliable way to recover retryDelay across SDK versions.
  const m = msg.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (!m) return null;
  const seconds = parseFloat(m[1]);
  if (!isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.ceil(seconds * 1000), 30_000); // cap at 30s per attempt
}

/**
 * Heuristic: a per-minute 429 always carries a `retryDelay` (e.g. 30s); a
 * per-day RPD exhaustion does not (Google can't promise a useful retry within
 * the next minute — the bucket only resets at midnight Pacific). Use this to
 * surface accurate UX instead of an exponentially growing 60s cooldown that
 * will never help against a daily quota.
 */
export function isDailyQuotaError(err: unknown): boolean {
  if (!isRateLimitError(err)) return false;
  return parseRetryDelayMs(err) === null;
}

/**
 * Friendly rate-limit error class — callers can detect this via
 * `err instanceof GeminiRateLimitError` and surface a 429 with the right
 * cooldown instead of a 500.
 */
export class GeminiRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly daily: boolean;
  constructor(message: string, retryAfterSeconds: number, daily: boolean) {
    super(message);
    this.name = "GeminiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.daily = daily;
  }
}

interface GenerateOptions {
  contents: Array<{ role: "user" | "model"; parts: { text: string }[] }>;
  config?: Record<string, unknown>;
  systemInstruction?: string;
  primaryModel?: string;
  fallbackModel?: string;
  /** Number of attempts on the primary model. Defaults to 3. */
  maxPrimaryAttempts?: number;
}

/**
 * Centralized Gemini call with retry + fallback model.
 *
 * Behavior:
 *   1. Up to N attempts on the primary model on RESOURCE_EXHAUSTED / 429,
 *      backing off using the API's own `retryDelay` hint or 1s → 2s → 4s.
 *   2. One final attempt on the fallback model (separate quota bucket).
 *   3. On total exhaustion, throws `GeminiRateLimitError` with `daily=true`
 *      if the original error had no `retryDelay` (per-day RPD) — callers
 *      should surface "daily quota reached, resets at midnight Pacific"
 *      instead of "try again in 60s".
 *   4. Non-rate-limit errors (auth, safety, network) rethrow immediately.
 *
 * **All Gemini callers in the app should use this** so retries and the
 * fallback bucket apply uniformly. See [src/lib/ai/gemini.ts](src/lib/ai/gemini.ts).
 */
export async function generateContentWithFallback(
  opts: GenerateOptions,
): Promise<Awaited<ReturnType<typeof genAI.models.generateContent>>> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const primary = opts.primaryModel || geminiModel;
  const fallback = opts.fallbackModel ?? geminiFallbackModel;
  const maxPrimaryAttempts = opts.maxPrimaryAttempts ?? 3;
  const config = {
    ...(opts.systemInstruction
      ? { systemInstruction: opts.systemInstruction }
      : {}),
    ...(opts.config || {}),
  };

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt++) {
    try {
      return await genAI.models.generateContent({
        model: primary,
        contents: opts.contents,
        config,
      });
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err)) throw err;

      if (attempt < maxPrimaryAttempts) {
        const hinted = parseRetryDelayMs(err);
        const backoff = hinted ?? Math.min(1000 * 2 ** (attempt - 1), 4000);
        console.warn(
          `[gemini] ${primary} 429 attempt ${attempt}/${maxPrimaryAttempts}, retrying in ${backoff}ms`,
        );
        await sleep(backoff);
      }
    }
  }

  // Primary exhausted — try fallback (separate quota bucket).
  if (fallback && fallback !== primary) {
    try {
      console.warn(
        `[gemini] primary ${primary} rate-limited, falling back to ${fallback}`,
      );
      return await genAI.models.generateContent({
        model: fallback,
        contents: opts.contents,
        config,
      });
    } catch (err) {
      if (!isRateLimitError(err)) throw err;
      lastErr = err;
    }
  }

  // Both buckets exhausted — surface a typed rate-limit error.
  const daily = isDailyQuotaError(lastErr);
  const hinted = parseRetryDelayMs(lastErr);
  // Daily quota: tell the user when it likely resets (midnight Pacific).
  // Per-minute: prefer Google's hint, else 60s.
  const retryAfter = daily ? secondsUntilPacificMidnight() : (hinted ?? 60_000);
  const friendly = daily
    ? "Gemini daily free-tier quota reached. Resets at midnight Pacific time."
    : `Gemini is rate-limited. Retry in ~${Math.ceil(retryAfter / 1000)}s.`;
  throw new GeminiRateLimitError(friendly, Math.ceil(retryAfter / 1000), daily);
}

/** Seconds until next 00:00 America/Los_Angeles, the Gemini RPD reset boundary. */
function secondsUntilPacificMidnight(): number {
  const now = Date.now();
  // Get the current LA time as a Date for arithmetic. The toLocaleString trick
  // gives us the wall-clock components in LA which we then turn back into UTC.
  const laParts = new Date(
    new Date(now).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
  );
  // Build "tomorrow at 00:00 LA local" from those parts and convert to UTC.
  const tomorrowLA = new Date(laParts);
  tomorrowLA.setHours(24, 0, 0, 0);
  const offsetMs = laParts.getTime() - now; // LA-local-as-UTC minus real-UTC
  const resetUtc = tomorrowLA.getTime() - offsetMs;
  return Math.max(60, Math.ceil((resetUtc - now) / 1000)); // never <60s
}

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
      `- ${c.name}: Budget $${c.budget.toFixed(2)}, Spent $${c.spent.toFixed(2)}, Remaining $${c.remaining.toFixed(2)}`,
  )
  .join("\n")}

Recurring Payments (Fixed Expenses):
${
  context.recurringPayments && context.recurringPayments.length > 0
    ? context.recurringPayments
        .map(
          (p) =>
            `- ${p.name}: $${p.amount.toFixed(2)} (${p.recurrence}, Next due: ${p.nextDue})`,
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
            `- ${g.name}: Target $${g.targetAmount.toFixed(2)}, Saved $${g.saved.toFixed(2)}, Due ${g.targetDate}`,
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
            `- ${t.date}: ${t.description} - $${t.amount.toFixed(2)} (${t.category})`,
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
  context?: BudgetContext,
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

  try {
    const response = await generateContentWithFallback({
      contents,
      systemInstruction: systemPrompt,
      config: {
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
  } catch (error) {
    if (error instanceof GeminiRateLimitError) throw error;
    if (error instanceof Error) {
      if (error.message.includes("Could not find model")) {
        throw new Error(`Invalid model: ${geminiModel}`);
      }
      if (error.message.includes("safety")) {
        throw new Error("Response blocked by safety filters");
      }
      throw error;
    }
    throw new Error(`Gemini API error: ${String(error)}`);
  }
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
  categories: string[],
): Promise<string> {
  const prompt = `Given this transaction description: "${description}"
  
Available categories: ${categories.join(", ")}

Which category best fits this transaction? Reply with just the category name.`;

  return sendMessageToGemini(prompt, []);
}
