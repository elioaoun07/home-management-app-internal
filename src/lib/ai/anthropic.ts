import Anthropic from "@anthropic-ai/sdk";

// Claude client for routes migrated off Gemini (ERA Ask AI first). Every other
// AI route still uses ./gemini (HUB-107). See ERA Notes/03 - Junction Modules/AI Assistant.
export const claudeModel = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Server-side refusal fallback ("default" routing) is accepted only on these.
const FALLBACK_MODELS = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
  "claude-fable-5-1",
]);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Route maxDuration is 60 s and context assembly runs first.
  client ??= new Anthropic({ timeout: 40_000, maxRetries: 1 });
  return client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ClaudeTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeJsonResult {
  text: string;
  model: string;
  stopReason: string | null;
  /** Input includes cache reads/writes; output includes thinking tokens. */
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * One structured-output call. The schema constrains the reply to JSON; callers
 * still validate it — the model's output is never trusted as-is.
 */
export async function generateClaudeJson(opts: {
  system: string;
  messages: ClaudeTurn[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** Live test passes send 0 (Hard Rule #29: no retries). */
  maxRetries?: number;
}): Promise<ClaudeJsonResult> {
  if (!isClaudeConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // The API requires a user turn first and rejects empty content.
  const messages = opts.messages.filter((m) => m.content.trim());
  while (messages[0]?.role === "assistant") messages.shift();

  const fallback = FALLBACK_MODELS.has(claudeModel);
  const response = await getClient().beta.messages.create({
    model: claudeModel,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages,
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema", schema: opts.schema },
    },
    ...(fallback
      ? {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }
      : {}),
  }, opts.maxRetries === undefined ? undefined : { maxRetries: opts.maxRetries });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const u = response.usage;
  return {
    text,
    model: response.model,
    stopReason: response.stop_reason,
    usage: {
      inputTokens:
        u.input_tokens +
        (u.cache_creation_input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0),
      outputTokens: u.output_tokens,
    },
  };
}
