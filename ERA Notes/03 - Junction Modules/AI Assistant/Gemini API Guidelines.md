---
created: 2026-03-23
type: feature-doc
module: ai-assistant
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/ai-assistant
---

# Gemini API Usage Guidelines

> **IMPORTANT**: Always follow these guidelines when working with Gemini API to prevent rate limits, avoid overcharges, and ensure optimal performance.

## Table of Contents

- [Current Architecture](#current-architecture)
- [Rate Limiting System](#rate-limiting-system)
- [Before Creating a New AI Feature](#before-creating-a-new-ai-feature)
- [Code Patterns](#code-patterns)
- [Checklist for AI Features](#checklist-for-ai-features)
- [Monitoring & Debugging](#monitoring--debugging)
- [Cost Estimation](#cost-estimation)

---

## Current Architecture

### AI Endpoints in the App

| Endpoint                          | Purpose           | File                                         |
| --------------------------------- | ----------------- | -------------------------------------------- |
| `POST /api/ai-chat`               | Budget AI Chatbot | `src/app/api/ai-chat/route.ts`               |
| `POST /api/recipes/[id]/generate` | Recipe Generation | `src/app/api/recipes/[id]/generate/route.ts` |

### Shared Resources

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `src/lib/ai/gemini.ts`     | Gemini client, model config, prompts |
| `src/lib/ai/rateLimit.ts`  | Persistent rate limiting utilities   |
| `src/lib/ai/tokenUtils.ts` | Token estimation utilities           |

### Rate Limit Configuration

```typescript
// From src/lib/ai/rateLimit.ts
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per user per minute
const GLOBAL_MAX_REQUESTS_PER_WINDOW = 10; // 10 requests globally per minute
const DEDUP_WINDOW_MS = 5_000; // 5 second deduplication
```

---

## Model Versioning Strategy (Future-Proof with Aliases)

> **Problem (2026-05-01)**: Model deprecation cascades. Google retired `gemini-2.0-flash-lite`, then `gemini-1.5-flash` became unavailable for this API key. Each deprecation required manual code updates across 5+ files.
>
> **Solution**: Use Google's `-latest` aliases (`gemini-flash-latest`, `gemini-flash-lite-latest`). These automatically point to the newest model in each family without code changes. When Google releases `gemini-3.5-flash`, the alias silently updates — **no rewrites needed**.
>
> **Why this works**:
> - Aliases never deprecate (Google maintains them as moving targets)
> - Lightweight variants (`-flash`, `-flash-lite`) stay current automatically
> - No per-model quota concerns (aliases route to the current model's bucket)
> - Eliminates surprise 404 errors from retired models

---

## Upstream 429 Resilience (Retry + Fallback Model)

> **Issue (2026-04-30)**: User reported `Gemini call failed: { code: 429, status: RESOURCE_EXHAUSTED }` immediately on opening the AI Chatbot — _despite not having actively used Gemini for several days_. Followed by a 60s in-memory cooldown that doubled on every retry.
>
> **Real root cause** (after audit, not the obvious "you spammed the chat"):
>
> 1. **9 separate endpoints** all hit `gemini-2.0-flash` from the same `GEMINI_API_KEY`, sharing **one** free-tier quota bucket (RPD ~200/day, RPM ~10–15/min):
>    - `/api/ai-chat`
>    - `/api/focus-insights` ← **was auto-firing on Focus page mount, no user gesture required**
>    - `/api/suggest-schedule`
>    - `/api/budget-allocations/ai-suggest`
>    - `/api/recipes/[id]/generate`, `/scale`, `/optimize`, `/substitute`
>    - `/api/recipes/extract-from-url`
> 2. **`useFocusInsights` had a `useEffect` that auto-called `POST /api/focus-insights`** whenever the cache returned `shouldRefresh: true` and `currentItems.length > 0`. Every visit to `/focus` (the home page for many users) silently consumed quota — without the user knowing they had "used Gemini today".
> 3. **Free-tier RPD resets at midnight Pacific** (~10am Beirut). Quota burned on Tuesday evening surfaces as a 429 on Wednesday morning.
> 4. **Only `/api/ai-chat` had any retry logic**; the other 8 endpoints surfaced raw 500s on 429, with no exponential backoff and no fallback model. So a single transient per-minute spike on any endpoint failed instead of recovering.
> 5. **The error body had no `retryDelay` field** — diagnostic of a _daily_ RPD quota hit, not per-minute. The route's exponentially-doubling 60s cooldown was treating it like a per-minute throttle, so it never gave up and never told the user "this won't clear until tomorrow".
> 6. **The cooldown was process-memory only** (`let lastRateLimitError`). On Vercel, every cold-start function instance reset it, so the system kept hammering Google and burning quota faster after a 429.
>
> **Fix shipped**:
>
> 1. **Centralized helper** [`generateContentWithFallback`](src/lib/ai/gemini.ts) — every Gemini caller now goes through it. Behavior:
>    - Up to 3 attempts on the primary model, backing off using Google's own `retryDelay` hint (capped 30s) or exponential 1s → 2s → 4s.
>    - One final attempt on a fallback model (`gemini-flash-lite-latest` by default) — separate quota bucket, lighter weight, often succeeds when primary is throttled.
>    - On total exhaustion, throws `GeminiRateLimitError` with `daily: boolean` and `retryAfterSeconds` based on whether the error had `retryDelay` (per-minute) or not (per-day).
>    - Non-rate-limit errors (auth, safety, network, invalid model) rethrow immediately — no wasted retries.
> 2. **All 9 endpoints migrated** to the helper (`/api/ai-chat`, `/api/focus-insights`, `/api/suggest-schedule`, `/api/budget-allocations/ai-suggest`, `/api/recipes/{generate,scale,optimize,substitute}`, `/api/recipes/extract-from-url`). Retry + fallback now apply uniformly.
> 3. **Daily-quota detection** — `isDailyQuotaError(err)` returns true when `RESOURCE_EXHAUSTED` has no `retryDelay`. The chat route surfaces a distinct message: `"Gemini daily free-tier quota reached. Resets at midnight Pacific time."` and `dailyQuotaExhausted: true` in the JSON, with `retryAfterSeconds` computed as seconds-until-Pacific-midnight.
> 4. **Removed the silent quota burner**: `useFocusInsights`'s auto-fire `useEffect` was deleted. Insight generation is now strictly user-gesture only via the existing `refresh()` callback. Cached insights still display normally; UI shows a "Refresh" affordance when `shouldRefresh` is true.
>
> **Env knobs** ([docs/ENV.md](docs/ENV.md)):
>
> - `GEMINI_MODEL` — primary (default `gemini-flash-latest`). Uses Google's `-latest` alias, which auto-updates to the newest Flash model **without requiring code changes** when Google releases a new version. No deprecation risk.
> - `GEMINI_FALLBACK_MODEL` — secondary, separate quota bucket (default `gemini-flash-lite-latest`). Also uses `-latest` alias for automatic updates. Set to the same value as `GEMINI_MODEL` to disable fallback.
>
> **Diagnosing a recurrence**:
>
> 1. Server logs: search for `[gemini] primary … rate-limited, falling back to …`. Frequent → quota too small for usage; bump tier.
> 2. `error_logs` table: filter `error_message LIKE '%Gemini%'`. If the rows show no `retryDelay` in stack, it's daily RPD — only midnight Pacific resets it.
> 3. `ai_messages` table: `SELECT date_trunc('hour', created_at), count(*) FROM ai_messages WHERE created_at > now() - interval '24h' GROUP BY 1` — shows real hourly usage. Look for surprise spikes (browsing recipes triggers scale/optimize/substitute/extract; opening Focus used to auto-fire).
> 4. **Never re-add an auto-fire `useEffect` for any AI endpoint.** If a feature genuinely needs proactive AI (e.g. dashboard briefing), gate it on a server-side cron with explicit per-user-per-day budget.

---

## Rate Limiting System

### Single Source of Truth

**`ai_messages` table** is the single source of truth for:

- ✅ Monthly token usage tracking
- ✅ Per-minute rate limiting (count user messages in last 60s)
- ✅ Today's request count

**`ai_rate_limits` table** is only used for:

- ⚡ Short-lived request hash deduplication (5 second window)
- 🗑️ Auto-cleaned every 5 minutes

### How It Works

```
User Request
     ↓
[1] Client-side: Button disabled during loading
     ↓
[2] Server: In-memory rate limit check (fast, per-instance)
     ↓
[3] Server: Request deduplication check (ai_rate_limits, 5s window)
     ↓
[4] Server: Per-user rate limit check (ai_messages, 5/min)
     ↓
[5] Server: Global rate limit check (ai_messages, 10/min)
     ↓
[6] Server: Record dedup hash in ai_rate_limits (short-lived)
     ↓
[7] Call Gemini API
     ↓
[8] Server: Log message in ai_messages (permanent, tracks tokens)
     ↓
[9] On 429 error: Record cooldown, NO automatic retry
```

### Database Tables

```sql
-- PRIMARY TABLE: ai_messages (single source of truth)
-- Tracks all AI messages, tokens, and is used for rate limiting

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  input_tokens INTEGER,         -- For token tracking
  output_tokens INTEGER,        -- For token tracking
  created_at TIMESTAMPTZ        -- Used for rate limit window
);

-- SECONDARY TABLE: ai_rate_limits (deduplication only)
-- Short-lived entries for preventing duplicate requests

CREATE TABLE ai_rate_limits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT,            -- Hash for deduplication
  created_at TIMESTAMPTZ        -- Auto-deleted after 5 min
);
```

---

## Before Creating a New AI Feature

### ⚠️ STOP and Answer These Questions

1. **Is AI necessary?** Can this be done with rules/logic instead?
2. **How often will this be called?** (per user session, per day?)
3. **Can responses be cached?** (same input = same output?)
4. **What's the token cost?** (input + output estimation)
5. **What happens if rate limited?** (graceful fallback?)

### Decision Tree

```
Need AI?
  ├─ No → Use regular logic
  └─ Yes → Can cache response?
              ├─ Yes → Implement caching first
              └─ No → Is it user-triggered only?
                        ├─ Yes → OK, add rate limiting
                        └─ No → RECONSIDER (auto-triggers are dangerous)
```

---

## Code Patterns

### ✅ CORRECT: New AI Endpoint

```typescript
// src/app/api/my-feature/route.ts
import { geminiModel } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordAIRequest,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // 1. Generate request hash for deduplication
  const requestHash = generateRequestHash(body.input);

  // 2. Check rate limit BEFORE any AI call
  const rateLimitCheck = await checkUserRateLimit(
    supabase,
    user.id,
    requestHash,
  );
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // 3. Record request BEFORE calling API
  await recordAIRequest(supabase, user.id, "my-feature", requestHash);

  // 4. Now call Gemini
  try {
    const response = await genAI.models.generateContent({
      model: geminiModel,
      contents: [{ role: "user", parts: [{ text: body.input }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024, // Always set a limit!
      },
    });

    return NextResponse.json({ result: response.text });
  } catch (error) {
    // 5. Handle 429 gracefully - don't expose internal errors
    if (error instanceof Error && error.message.includes("429")) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again in a minute." },
        { status: 429 },
      );
    }
    throw error;
  }
}
```

### ✅ CORRECT: Client-Side Hook (No Retries)

```typescript
// In your hooks file
export function useMyAIFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: callMyAIEndpoint,
    // CRITICAL: Disable retries for AI calls
    retry: false,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

### ✅ CORRECT: Button with Loading State

```tsx
<Button
  onClick={handleAIAction}
  disabled={mutation.isPending} // Prevents double-clicks
>
  {mutation.isPending ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    <Sparkles className="w-4 h-4" />
  )}
  Generate with AI
</Button>
```

### ❌ WRONG: Common Mistakes

```typescript
// ❌ NO: Auto-triggering AI in useEffect
useEffect(() => {
  fetchAISuggestion(); // This runs on every mount!
}, []);

// ❌ NO: AI call without rate limiting
const response = await genAI.models.generateContent({...});

// ❌ NO: Mutation with retry enabled
useMutation({
  mutationFn: callAI,
  retry: 3, // Will cause 4x API calls on failure!
});

// ❌ NO: No maxOutputTokens limit
config: {
  temperature: 0.7,
  // Missing maxOutputTokens = can return huge responses
}

// ❌ NO: Calling AI in a loop
for (const item of items) {
  await generateAIContent(item); // Rate limit disaster!
}
```

---

## Checklist for AI Features

### Before Writing Code

- [ ] Confirmed AI is necessary (no simpler solution)
- [ ] Estimated requests per user per day
- [ ] Estimated tokens per request (input + output)
- [ ] Calculated monthly cost estimate
- [ ] Planned graceful fallback for rate limits

### Server-Side (API Route)

- [ ] Import rate limiting utilities from `@/lib/ai/rateLimit`
- [ ] Generate request hash with `generateRequestHash()`
- [ ] Check rate limit with `checkUserRateLimit()` BEFORE AI call
- [ ] Record request with `recordAIRequest()` BEFORE AI call
- [ ] Set `maxOutputTokens` in config (recommended: 1024-2048)
- [ ] Handle 429 errors gracefully
- [ ] Log errors for debugging

### Client-Side (React)

- [ ] Use `useMutation` with `retry: false`
- [ ] Disable button while `isPending`
- [ ] Show loading indicator
- [ ] Display user-friendly error messages
- [ ] Don't auto-trigger AI in useEffect

### Testing

- [ ] Test rate limit by clicking button rapidly
- [ ] Test with slow network (should not duplicate)
- [ ] Verify error messages are user-friendly
- [ ] Check Gemini dashboard for request count

---

## Monitoring & Debugging

### Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select your project (ChatBot)
3. Navigate to: APIs & Services → Gemini API → Metrics

### Key Metrics to Watch

| Metric          | Alert Threshold            |
| --------------- | -------------------------- |
| Requests/minute | > 8 (approaching 10 limit) |
| 429 Error Rate  | > 0 (any 429 is bad)       |
| Daily Requests  | > 1000 (check for issues)  |

### Debugging Rate Limits

```sql
-- Check recent AI requests for a user
SELECT * FROM ai_rate_limits
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 20;

-- Check requests in last minute (rate limit window)
SELECT user_id, COUNT(*) as requests
FROM ai_rate_limits
WHERE created_at > now() - INTERVAL '1 minute'
GROUP BY user_id
ORDER BY requests DESC;

-- Find duplicate requests
SELECT request_hash, COUNT(*)
FROM ai_rate_limits
WHERE created_at > now() - INTERVAL '5 minutes'
GROUP BY request_hash
HAVING COUNT(*) > 1;
```

### Server Logs

Look for these log messages:

```
AI Chat rate limit cooldown set to Xs   → Rate limit was hit
Rate limit check error: ...             → DB issue
Failed to record AI request: ...        → Recording failed
```

---

## Cost Estimation

### Gemini 2.0 Flash Pricing (Paid Tier)

| Token Type | Price per 1M Tokens |
| ---------- | ------------------- |
| Input      | $0.10               |
| Output     | $0.40               |

### Typical Request Costs

| Feature                | Input Tokens | Output Tokens | Cost      |
| ---------------------- | ------------ | ------------- | --------- |
| AI Chat (with context) | ~1,500       | ~500          | ~$0.00035 |
| AI Chat (no context)   | ~200         | ~500          | ~$0.00022 |
| Recipe Generation      | ~300         | ~1,000        | ~$0.00043 |

### Monthly Budget ($10)

| Usage Level | Chats/day | Recipes/day | Monthly Cost |
| ----------- | --------- | ----------- | ------------ |
| Light       | 10        | 2           | ~$0.40       |
| Moderate    | 30        | 5           | ~$1.10       |
| Heavy       | 100       | 10          | ~$3.00       |
| Max Safe    | 300       | 20          | ~$8.50       |

### Formula

```
Monthly Cost = (Daily Requests × 30) × Average Cost per Request

Example:
- 50 chats/day × $0.00035 = $0.0175/day
- 50 × 30 × $0.00035 = $0.525/month
```

---

## Quick Reference

### Import Statement (Copy-Paste)

```typescript
import { geminiModel } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordAIRequest,
} from "@/lib/ai/rateLimit";
```

### Rate Limit Check (Copy-Paste)

```typescript
const requestHash = generateRequestHash(inputString);
const rateLimitCheck = await checkUserRateLimit(supabase, user.id, requestHash);
if (!rateLimitCheck.allowed) {
  return NextResponse.json(
    {
      error: rateLimitCheck.reason,
      retryAfter: rateLimitCheck.retryAfterSeconds,
    },
    { status: 429 },
  );
}
await recordAIRequest(supabase, user.id, "endpoint-name", requestHash);
```

### Gemini Config (Copy-Paste)

```typescript
const response = await genAI.models.generateContent({
  model: geminiModel,
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  config: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 1024,
  },
});
```

---

## Summary

| Rule                            | Why                                 |
| ------------------------------- | ----------------------------------- |
| Always use rate limiting        | Prevents 429 errors and cost spikes |
| Set `retry: false` on mutations | Prevents cascade of retries         |
| Disable button while loading    | Prevents double-clicks              |
| Set `maxOutputTokens`           | Controls response size and cost     |
| Never auto-trigger AI           | User must initiate all AI calls     |
| Log all AI requests             | Enables debugging and monitoring    |
| Handle 429 gracefully           | Better UX than cryptic errors       |

**Remember**: Every AI call costs money and counts against rate limits. Be conservative!
