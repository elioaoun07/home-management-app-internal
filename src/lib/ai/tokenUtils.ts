/**
 * Token estimation utilities for Gemini API usage tracking
 *
 * Note: These are estimates. Actual token counts may vary slightly.
 * Gemini uses a different tokenizer than OpenAI, but for estimation purposes,
 * the ~4 characters per token rule works reasonably well for English text.
 */

/**
 * Estimate token count for a string
 * Uses a simple heuristic: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Simple estimation: ~4 characters per token
  // This is a rough estimate that works reasonably well for English
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Use a weighted average of character and word-based estimates
  const charBasedEstimate = Math.ceil(charCount / 4);
  const wordBasedEstimate = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word

  return Math.ceil((charBasedEstimate + wordBasedEstimate) / 2);
}

/**
 * Estimate tokens for a chat message with context
 */
export interface TokenEstimate {
  systemPrompt: number;
  budgetContext: number;
  chatHistory: number;
  userMessage: number;
  totalInput: number;
}

export function estimateInputTokens(
  systemPromptLength: number,
  budgetContextLength: number,
  chatHistoryLength: number,
  userMessageLength: number
): TokenEstimate {
  const systemPrompt = estimateTokens(" ".repeat(systemPromptLength));
  const budgetContext = estimateTokens(" ".repeat(budgetContextLength));
  const chatHistory = estimateTokens(" ".repeat(chatHistoryLength));
  const userMessage = estimateTokens(" ".repeat(userMessageLength));

  return {
    systemPrompt,
    budgetContext,
    chatHistory,
    userMessage,
    totalInput: systemPrompt + budgetContext + chatHistory + userMessage,
  };
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * Calculate usage percentage of monthly limit
 */
export function calculateUsagePercentage(
  usedTokens: number,
  limit: number = 1_000_000
): number {
  return Math.min((usedTokens / limit) * 100, 100);
}

/**
 * Get remaining tokens in monthly limit
 */
export function getRemainingTokens(
  usedTokens: number,
  limit: number = 1_000_000
): number {
  return Math.max(limit - usedTokens, 0);
}

/**
 * Estimate cost savings compared to paid API
 * (For reference - Gemini free tier vs OpenAI pricing)
 */
export function estimateSavings(tokens: number): number {
  // OpenAI GPT-4 pricing is roughly $0.03/1K input + $0.06/1K output
  // Average: ~$0.045/1K tokens
  const openAiCostPer1k = 0.045;
  return (tokens / 1000) * openAiCostPer1k;
}
