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
  // Tests can never reach the paid API: tests/setup/blockPaidApis.ts.
  // Route maxDuration is 60 s and context assembly runs first. SDK retries
  // are off: a timed-out attempt is still billed, so retries are ours (below).
  client ??= new Anthropic({ timeout: 40_000, maxRetries: 0 });
  return client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * A timeout or dropped connection may still have been processed and billed.
 * HTTP errors (4xx, 429, 5xx, 529) are not billed.
 */
export function mayHaveBeenBilled(err: unknown): boolean {
  return err instanceof Anthropic.APIConnectionError;
}

/** Rejected before any work was done: free and safe to retry. */
function isRetryable(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError) || mayHaveBeenBilled(err)) return false;
  return err.status === 429 || (err.status ?? 0) >= 500;
}

export interface ClaudeTurn {
  role: "user" | "assistant";
  content: string;
}

/** `stable` is cached across calls and users; it must not vary per request. */
export interface ClaudeSystem {
  stable: string;
  dynamic: string;
}

export interface ClaudeJsonResult {
  text: string;
  model: string;
  stopReason: string | null;
  /** Input includes cache reads/writes; output includes thinking tokens. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

/**
 * One structured-output call. The schema constrains the reply to JSON; callers
 * still validate it — the model's output is never trusted as-is.
 */
export async function generateClaudeJson(opts: {
  system: string | ClaudeSystem;
  messages: ClaudeTurn[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** Retries of free rejections (429/5xx) only; never of a timeout. */
  maxRetries?: number;
}): Promise<ClaudeJsonResult> {
  if (!isClaudeConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // The API requires a user turn first and rejects empty content.
  const messages = opts.messages.filter((m) => m.content.trim());
  while (messages[0]?.role === "assistant") messages.shift();

  const system =
    typeof opts.system === "string"
      ? opts.system
      : [
          { type: "text" as const, text: opts.system.stable, cache_control: { type: "ephemeral" as const } },
          ...(opts.system.dynamic.trim()
            ? [{ type: "text" as const, text: opts.system.dynamic }]
            : []),
        ];

  const fallback = FALLBACK_MODELS.has(claudeModel);
  const params = {
    model: claudeModel,
    max_tokens: opts.maxTokens ?? 16000,
    system,
    messages,
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema" as const, schema: opts.schema },
    },
    ...(fallback
      ? {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }
      : {}),
  };

  const retries = opts.maxRetries ?? 1;
  let response;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await getClient().beta.messages.create(params);
      break;
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const u = response.usage;
  const cacheReadTokens = u.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
  return {
    text,
    model: response.model,
    stopReason: response.stop_reason,
    usage: {
      inputTokens: u.input_tokens + cacheWriteTokens + cacheReadTokens,
      outputTokens: u.output_tokens,
      cacheReadTokens,
      cacheWriteTokens,
    },
  };
}
