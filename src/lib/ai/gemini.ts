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
  };
}

/**
 * Generate a system prompt with budget context
 */
export function generateSystemPrompt(context?: BudgetContext): string {
  const basePrompt = `You are a helpful AI budget assistant for a personal finance app. Your name is "Budget AI".

Your capabilities:
- Analyze spending patterns and provide insights
- Suggest budget optimizations
- Answer questions about transactions and categories
- Provide savings tips and financial advice
- Help categorize transactions
- Explain budget summaries

Guidelines:
- Be concise and friendly
- Use bullet points for lists
- Format currency amounts clearly (e.g., $1,234.56)
- When giving advice, be practical and actionable
- If you don't have enough context, ask clarifying questions
- Never provide specific investment advice - suggest consulting a financial advisor for that
- Keep responses focused on budgeting and personal finance`;

  if (!context) {
    return basePrompt;
  }

  const contextPrompt = `

Current Budget Context (${context.currentMonth}):
- Total Budget: $${context.totalBudget.toFixed(2)}
- Total Spent: $${context.totalSpent.toFixed(2)}
- Remaining: $${context.totalRemaining.toFixed(2)}

Categories (This Month):
${context.categories
  .map(
    (c) =>
      `- ${c.name}: Budget $${c.budget.toFixed(2)}, Spent $${c.spent.toFixed(2)}, Remaining $${c.remaining.toFixed(2)}`
  )
  .join("\n")}

Recent Transactions (This Month, last 10):
${
  context.recentTransactions.length > 0
    ? context.recentTransactions
        .slice(0, 10)
        .map(
          (t) =>
            `- ${t.date}: ${t.description} - $${t.amount.toFixed(2)} (${t.category})`
        )
        .join("\n")
    : "No transactions this month yet."
}${
    context.lastMonth
      ? `

Last Month (${context.lastMonth.month}):
- Total Spent: $${context.lastMonth.totalSpent.toFixed(2)}

Categories (Last Month):
${context.lastMonth.categories
  .map((c) => `- ${c.name}: Spent $${c.spent.toFixed(2)}`)
  .join("\n")}

Transactions (Last Month):
${
  context.lastMonth.transactions.length > 0
    ? context.lastMonth.transactions
        .slice(0, 15)
        .map(
          (t) =>
            `- ${t.date}: ${t.description} - $${t.amount.toFixed(2)} (${t.category})`
        )
        .join("\n")
    : "No transactions last month."
}`
      : ""
  }`;

  return basePrompt + contextPrompt;
}

/**
 * Send a message to Gemini and get a response
 */
export async function sendMessageToGemini(
  message: string,
  chatHistory: ChatMessage[],
  context?: BudgetContext
): Promise<string> {
  const systemPrompt = generateSystemPrompt(context);

  // Build conversation history for Gemini
  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text:
            systemPrompt + "\n\nPlease acknowledge you understand your role.",
        },
      ],
    },
    {
      role: "model" as const,
      parts: [
        {
          text: "I understand! I'm Budget AI, your personal finance assistant. I'm here to help you analyze your spending, optimize your budget, and provide practical financial advice. How can I help you today?",
        },
      ],
    },
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
