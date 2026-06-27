// src/lib/ai/analysisReport.ts
//
// The **single source of truth** for the Budget AI "spending analysis" feature.
//
// One strict schema (`AnalysisReport`) powers BOTH:
//   1. the text answer shown in the chat (its `narrative`, rendered as markdown), and
//   2. the on-demand visual dashboard (its structured fields → recharts widgets).
//
// Robustness is the whole point: the model is constrained three ways so the
// dashboard renderer can never break —
//   (a) Gemini structured output via `ANALYSIS_RESPONSE_SCHEMA` (responseSchema),
//   (b) tolerant Zod validation that drops malformed pieces instead of throwing,
//   (c) a deterministic `buildFallbackReport()` when the model is unavailable/invalid.
//
// See ERA Notes/03 - Junction Modules/AI Assistant/Spending Analysis Report.md

import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import {
  type BudgetContext,
  type ChatMessage,
  generateContentWithFallback,
} from "./gemini";

export type { MonthlyTrendPoint } from "./gemini";

// ───────────────────────────── Zod schema (validation) ─────────────────────────────
// Every field is tolerant: bad values fall back, missing arrays become []. The
// schema is designed to NEVER throw on a syntactically-valid JSON object.

/** Parse an array element-by-element, silently dropping malformed entries. */
function tolerantArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(z.unknown())
    .transform((arr) =>
      arr.flatMap((el) => {
        const r = item.safeParse(el);
        return r.success ? [r.data as z.infer<T>] : [];
      }),
    )
    .catch([] as z.infer<T>[]);
}

const KpiSchema = z.object({
  id: z.string().catch(""),
  label: z.string().catch(""),
  value: z.coerce.number().catch(0),
  unit: z.enum(["currency", "percent", "number"]).catch("currency"),
  delta: z.coerce.number().nullish(),
  deltaLabel: z.string().nullish(),
  direction: z.enum(["up", "down", "flat"]).nullish(),
  sentiment: z.enum(["positive", "negative", "neutral"]).nullish(),
});

const CategorySchema = z.object({
  name: z.string().catch(""),
  amount: z.coerce.number().catch(0),
  percentage: z.coerce.number().catch(0),
  color: z.string().nullish(),
  deltaPct: z.coerce.number().nullish(),
  comment: z.string().nullish(),
});

const TrendPointSchema = z.object({
  period: z.string().catch(""),
  income: z.coerce.number().catch(0),
  expense: z.coerce.number().catch(0),
  net: z.coerce.number().catch(0),
});

const InsightSchema = z.object({
  type: z.enum(["positive", "warning", "opportunity", "anomaly"]).catch("opportunity"),
  title: z.string().catch(""),
  detail: z.string().catch(""),
  amount: z.coerce.number().nullish(),
});

const RecommendationSchema = z.object({
  action: z.string().catch(""),
  rationale: z.string().catch(""),
  estimatedImpact: z.coerce.number().nullish(),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
});

export const AnalysisReportSchema = z.object({
  period: z
    .object({
      label: z.string().catch(""),
      start: z.string().nullish(),
      end: z.string().nullish(),
    })
    .catch({ label: "" }),
  headline: z.string().catch(""),
  narrative: z.string().catch(""),
  kpis: tolerantArray(KpiSchema),
  categoryBreakdown: tolerantArray(CategorySchema),
  trend: tolerantArray(TrendPointSchema),
  insights: tolerantArray(InsightSchema),
  recommendations: tolerantArray(RecommendationSchema),
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
export type AnalysisKpi = z.infer<typeof KpiSchema>;
export type AnalysisCategory = z.infer<typeof CategorySchema>;
export type AnalysisInsight = z.infer<typeof InsightSchema>;
export type AnalysisRecommendation = z.infer<typeof RecommendationSchema>;

/** True when a parsed report actually carries something worth showing. */
export function reportHasContent(r: AnalysisReport): boolean {
  return Boolean(
    r.narrative.trim() ||
      r.headline.trim() ||
      r.kpis.length ||
      r.categoryBreakdown.length ||
      r.insights.length ||
      r.recommendations.length,
  );
}

// ───────────────────────── Gemini structured-output schema ─────────────────────────
// Mirrors the Zod shape. `required` is intentionally minimal at the leaf level so
// the model is never forced to invent optional fields, but the top level demands a
// narrative + the core data sections.

const enumStr = (values: string[]): Schema => ({ type: Type.STRING, enum: values });

export const ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: [
    "period",
    "headline",
    "narrative",
    "kpis",
    "categoryBreakdown",
    "trend",
    "insights",
    "recommendations",
  ],
  required: ["headline", "narrative", "kpis", "categoryBreakdown", "insights", "recommendations"],
  properties: {
    period: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: "Human label, e.g. 'May 2026'" },
        start: { type: Type.STRING, nullable: true, description: "ISO date YYYY-MM-DD" },
        end: { type: Type.STRING, nullable: true },
      },
      required: ["label"],
    },
    headline: {
      type: Type.STRING,
      description: "One punchy sentence verdict on the period, e.g. 'Solid month — you saved $420.'",
    },
    narrative: {
      type: Type.STRING,
      description:
        "The full conversational answer the user reads in chat. Markdown: short ## headings in Title Case (never ALL CAPS), **bold** key numbers, bullet lists. 150–320 words, warm and specific. Use normal sentence case throughout.",
    },
    kpis: {
      type: Type.ARRAY,
      description: "4–6 headline metrics for the period.",
      items: {
        type: Type.OBJECT,
        required: ["id", "label", "value", "unit"],
        properties: {
          id: { type: Type.STRING, description: "stable snake_case key, e.g. 'total_expenses'" },
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
          unit: enumStr(["currency", "percent", "number"]),
          delta: { type: Type.NUMBER, nullable: true, description: "signed change vs previous period" },
          deltaLabel: { type: Type.STRING, nullable: true, description: "e.g. 'vs April'" },
          direction: { ...enumStr(["up", "down", "flat"]), nullable: true },
          sentiment: {
            ...enumStr(["positive", "negative", "neutral"]),
            nullable: true,
            description: "Is this movement good or bad FOR THE USER (e.g. expenses up = negative).",
          },
        },
      },
    },
    categoryBreakdown: {
      type: Type.ARRAY,
      description: "Per-category spend for the period, largest first.",
      items: {
        type: Type.OBJECT,
        required: ["name", "amount", "percentage"],
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          percentage: { type: Type.NUMBER, description: "share of total expenses, 0–100" },
          color: { type: Type.STRING, nullable: true, description: "hex like #22d3ee (optional)" },
          deltaPct: { type: Type.NUMBER, nullable: true, description: "percent change vs previous period" },
          comment: { type: Type.STRING, nullable: true, description: "one short note shown under the bar" },
        },
      },
    },
    trend: {
      type: Type.ARRAY,
      description: "Monthly time series (oldest→newest) for the trend chart. Use ONLY the months provided in context.",
      items: {
        type: Type.OBJECT,
        required: ["period", "income", "expense", "net"],
        properties: {
          period: { type: Type.STRING, description: "YYYY-MM" },
          income: { type: Type.NUMBER },
          expense: { type: Type.NUMBER },
          net: { type: Type.NUMBER },
        },
      },
    },
    insights: {
      type: Type.ARRAY,
      description: "3–5 noteworthy findings.",
      items: {
        type: Type.OBJECT,
        required: ["type", "title", "detail"],
        properties: {
          type: enumStr(["positive", "warning", "opportunity", "anomaly"]),
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          amount: { type: Type.NUMBER, nullable: true },
        },
      },
    },
    recommendations: {
      type: Type.ARRAY,
      description: "2–4 concrete next actions.",
      items: {
        type: Type.OBJECT,
        required: ["action", "rationale", "priority"],
        properties: {
          action: { type: Type.STRING },
          rationale: { type: Type.STRING },
          estimatedImpact: { type: Type.NUMBER, nullable: true, description: "estimated $ saved per month" },
          priority: enumStr(["high", "medium", "low"]),
        },
      },
    },
  },
};

// ─────────────────────────────── intent detection ───────────────────────────────

const ANALYSIS_KEYWORDS =
  /\b(analy[sz]e|analysis|spending|spend|breakdown|break down|where.*(money|save)|save money|on track|overview|summary|summari[sz]e|report|routine|habits?|trends?|cash\s?flow|how (am|are) i doing|review my|insights?)\b/i;

/** Heuristic: should this message produce a full structured analysis report? */
export function isAnalysisIntent(message: string): boolean {
  return ANALYSIS_KEYWORDS.test(message || "");
}

// ───────────────────────────── prompt construction ─────────────────────────────

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Build the analyst system prompt: persona + enriched, precomputed context + strict output contract. */
export function generateAnalysisSystemPrompt(
  context: BudgetContext,
  userMessage: string,
): string {
  const totalSpent = context.totalSpent || 0;
  const totalIncome = context.totalIncome || 0;
  const net = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  const burn =
    context.totalBudget > 0 ? (totalSpent / context.totalBudget) * 100 : 0;

  // Precompute category share + month-over-month delta so the model reasons over
  // derived metrics instead of re-deriving them from raw rows (and getting them wrong).
  const lastByName = new Map(
    (context.lastMonth?.categories || []).map((c) => [c.name, c.spent]),
  );
  const cats = (context.categories || [])
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((c) => {
      const pct = totalSpent > 0 ? (c.spent / totalSpent) * 100 : 0;
      const last = lastByName.get(c.name);
      const deltaPct =
        last && last > 0 ? ((c.spent - last) / last) * 100 : null;
      const overBudget = c.budget > 0 && c.spent > c.budget;
      return `- ${c.name}: ${fmt(c.spent)} (${pct.toFixed(1)}% of spend)${
        deltaPct !== null ? `, ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% vs prev month` : ""
      }${c.budget > 0 ? `, budget ${fmt(c.budget)}${overBudget ? " ⚠ OVER" : ""}` : ""}`;
    })
    .join("\n");

  const trendText = (context.monthlyTrend || [])
    .map(
      (m) =>
        `- ${m.period}: income ${fmt(m.income)}, expense ${fmt(m.expense)}, net ${fmt(m.net)}`,
    )
    .join("\n");

  const recurringText =
    context.recurringPayments && context.recurringPayments.length > 0
      ? context.recurringPayments
          .map((p) => `- ${p.name}: ${fmt(p.amount)} (${p.recurrence})`)
          .join("\n")
      : "None recorded.";

  const goalsText =
    context.futurePurchases && context.futurePurchases.length > 0
      ? context.futurePurchases
          .map(
            (g) =>
              `- ${g.name}: saved ${fmt(g.saved)} / ${fmt(g.targetAmount)} (due ${g.targetDate})`,
          )
          .join("\n")
      : "None set.";

  return `You are "Budget AI" — an expert financial analyst and warm, encouraging money coach.

Your job: given the user's request and the financial context below, produce ONE deep, organized spending analysis. Be specific and quantitative — cite real numbers and percentages from the context. Identify patterns in the user's spending routine, flag risks and anomalies, celebrate wins, and give concrete, prioritized actions. Never invent data that isn't in the context. Never give specific investment advice.

USER REQUEST: "${userMessage}"

=== FINANCIAL CONTEXT ===
Income and expenses are tracked separately — never count income as spending.

Current month (${context.currentMonth}):
- Total expenses: ${fmt(totalSpent)}
- Total income: ${fmt(totalIncome)}
- Net cash flow: ${fmt(net)}
- Savings rate: ${savingsRate.toFixed(1)}%
- Budget: ${fmt(context.totalBudget)} (${burn.toFixed(0)}% used, ${fmt(context.totalRemaining)} remaining)
${
  context.lastMonth
    ? `\nPrevious month (${context.lastMonth.month}):
- Total expenses: ${fmt(context.lastMonth.totalSpent)}
- Total income: ${fmt(context.lastMonth.totalIncome || 0)}
- Net: ${fmt((context.lastMonth.totalIncome || 0) - context.lastMonth.totalSpent)}`
    : ""
}

Category spend this month (with share + month-over-month change):
${cats || "- No categorized spending yet."}

Monthly trend (oldest → newest)${context.monthlyTrend?.length ? "" : " — none available"}:
${trendText || "- Not enough history."}

Recurring fixed costs:
${recurringText}

Savings goals:
${goalsText}

=== OUTPUT CONTRACT (STRICT) ===
Respond with ONLY a single valid JSON object — no prose, no markdown fences, nothing outside the JSON. It MUST match this shape exactly:

{
  "period": { "label": "May 2026", "start": "2026-05-01", "end": "2026-05-31" },
  "headline": "One-sentence verdict citing the key number.",
  "narrative": "Markdown answer in chat: ## headings in Title Case (NOT ALL CAPS), **bold** key numbers, bullet points. 150-320 words, warm and specific.",
  "kpis": [
    { "id": "total_expenses", "label": "Total Expenses", "value": 722.56, "unit": "currency", "delta": -45.2, "deltaLabel": "vs April", "direction": "down", "sentiment": "positive" }
  ],
  "categoryBreakdown": [
    { "name": "Transport", "amount": 280, "percentage": 38.8, "deltaPct": 12, "comment": "Largest bucket; fuel-heavy." }
  ],
  "trend": [ { "period": "2026-04", "income": 0, "expense": 722.56, "net": -722.56 } ],
  "insights": [
    { "type": "warning", "title": "No income recorded", "detail": "Spending ran ahead of recorded income this month.", "amount": 722.56 }
  ],
  "recommendations": [
    { "action": "Cap Transport at $230 next month", "rationale": "It is 38% of spend and rising.", "estimatedImpact": 50, "priority": "high" }
  ]
}

Rules:
- Populate kpis (4–6), categoryBreakdown (largest first), insights (3–5), and recommendations (2–4) every time there is data.
- For "trend", use ONLY the months listed in the Monthly trend context (copy their numbers). If none, return [].
- "sentiment" reflects whether the movement is good for the user (e.g. expenses going up = "negative", savings up = "positive").
- "percentage" is each category's share of total expenses (0–100). Keep numbers as plain numbers (no "$" or "%" inside JSON values).
- The "narrative" and the structured fields MUST tell the same story with the same numbers.
- Write the "narrative" in normal sentence case. Use Title Case for ## headings. NEVER write in ALL CAPS.`;
}

// ───────────────────────────── parsing & generation ─────────────────────────────

/** Parse model text → validated report, tolerating fenced blocks / stray prose. Returns null if nothing usable. */
export function parseAnalysisReport(text: string | undefined): AnalysisReport | null {
  if (!text) return null;
  const attempt = (s: string): AnalysisReport | null => {
    try {
      const parsed = AnalysisReportSchema.safeParse(JSON.parse(s));
      if (parsed.success && reportHasContent(parsed.data)) return parsed.data;
    } catch {
      /* not valid JSON — fall through to next strategy */
    }
    return null;
  };

  return (
    attempt(text) ??
    (() => {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      return fenced ? attempt(fenced[1].trim()) : null;
    })() ??
    (() => {
      const brace = text.match(/\{[\s\S]*\}/);
      return brace ? attempt(brace[0]) : null;
    })()
  );
}

/**
 * Generate a spending-analysis report. Always resolves to a usable report:
 * Gemini structured output when available, deterministic fallback otherwise.
 * Never throws — the dashboard must always have data to render.
 */
export async function generateAnalysisReport(args: {
  message: string;
  history?: ChatMessage[];
  context: BudgetContext;
}): Promise<AnalysisReport> {
  const { message, history = [], context } = args;

  if (process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = generateAnalysisSystemPrompt(context, message);
      const contents = [
        ...history.slice(-8).map((m) => ({
          role: (m.role === "user" ? "user" : "model") as "user" | "model",
          parts: [{ text: m.content }],
        })),
        { role: "user" as const, parts: [{ text: message }] },
      ];
      const response = await generateContentWithFallback({
        contents,
        systemInstruction: systemPrompt,
        config: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
        },
      });
      const parsed = parseAnalysisReport(response.text);
      if (parsed) return enrichWithContext(parsed, context);
    } catch {
      // Swallow (rate limit, network, bad JSON) → deterministic fallback below.
      // The user still gets a real, data-backed dashboard.
    }
  }

  return buildFallbackReport(context);
}

/** Backfill an AI report's `trend` from context when the model left it empty. */
function enrichWithContext(
  report: AnalysisReport,
  context: BudgetContext,
): AnalysisReport {
  if (report.trend.length === 0 && context.monthlyTrend?.length) {
    report.trend = context.monthlyTrend.map((m) => ({
      period: m.period,
      income: m.income,
      expense: m.expense,
      net: m.net,
    }));
  }
  return report;
}

// ───────────────────────── deterministic fallback report ─────────────────────────

/** Build a real, data-backed report from context alone — no AI required. */
export function buildFallbackReport(context: BudgetContext): AnalysisReport {
  const totalSpent = context.totalSpent || 0;
  const totalIncome = context.totalIncome || 0;
  const net = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  const lastSpent = context.lastMonth?.totalSpent ?? 0;
  const lastIncome = context.lastMonth?.totalIncome ?? 0;

  const lastByName = new Map(
    (context.lastMonth?.categories || []).map((c) => [c.name, c.spent]),
  );

  const categoryBreakdown: AnalysisCategory[] = (context.categories || [])
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((c) => {
      const last = lastByName.get(c.name);
      return {
        name: c.name,
        amount: c.spent,
        percentage: totalSpent > 0 ? (c.spent / totalSpent) * 100 : 0,
        deltaPct: last && last > 0 ? ((c.spent - last) / last) * 100 : undefined,
        comment:
          c.budget > 0 && c.spent > c.budget
            ? `Over budget by ${fmt(c.spent - c.budget)}`
            : undefined,
      };
    });

  const kpis: AnalysisKpi[] = [
    {
      id: "total_expenses",
      label: "Total Expenses",
      value: totalSpent,
      unit: "currency",
      delta: lastSpent ? totalSpent - lastSpent : undefined,
      deltaLabel: context.lastMonth ? `vs ${context.lastMonth.month}` : undefined,
      direction: lastSpent ? (totalSpent >= lastSpent ? "up" : "down") : undefined,
      sentiment: lastSpent ? (totalSpent > lastSpent ? "negative" : "positive") : "neutral",
    },
    {
      id: "total_income",
      label: "Total Income",
      value: totalIncome,
      unit: "currency",
      delta: lastIncome ? totalIncome - lastIncome : undefined,
      deltaLabel: context.lastMonth ? `vs ${context.lastMonth.month}` : undefined,
      direction: lastIncome ? (totalIncome >= lastIncome ? "up" : "down") : undefined,
      sentiment: lastIncome ? (totalIncome >= lastIncome ? "positive" : "negative") : "neutral",
    },
    {
      id: "net_cash_flow",
      label: "Net Cash Flow",
      value: net,
      unit: "currency",
      sentiment: net >= 0 ? "positive" : "negative",
    },
  ];
  if (totalIncome > 0) {
    kpis.push({
      id: "savings_rate",
      label: "Savings Rate",
      value: savingsRate,
      unit: "percent",
      sentiment: savingsRate >= 0 ? "positive" : "negative",
    });
  }
  if (context.totalBudget > 0) {
    kpis.push({
      id: "budget_remaining",
      label: "Budget Remaining",
      value: context.totalRemaining,
      unit: "currency",
      sentiment: context.totalRemaining >= 0 ? "positive" : "negative",
    });
  }

  const insights: AnalysisInsight[] = [];
  const top = categoryBreakdown[0];
  if (top) {
    insights.push({
      type: "opportunity",
      title: `${top.name} is your largest expense`,
      detail: `${top.name} accounts for ${top.percentage.toFixed(0)}% of spending (${fmt(top.amount)}).`,
      amount: top.amount,
    });
  }
  const overBudget = (context.categories || []).filter(
    (c) => c.budget > 0 && c.spent > c.budget,
  );
  if (overBudget.length > 0) {
    insights.push({
      type: "warning",
      title: `Over budget in ${overBudget.length} categor${overBudget.length === 1 ? "y" : "ies"}`,
      detail: overBudget
        .map((c) => `${c.name} (+${fmt(c.spent - c.budget)})`)
        .join(", "),
    });
  }
  insights.push(
    net >= 0
      ? {
          type: "positive",
          title: "Positive cash flow",
          detail: `You kept ${fmt(net)} this period.`,
          amount: net,
        }
      : {
          type: "warning",
          title: "Spending outpaced income",
          detail: `Expenses exceeded income by ${fmt(-net)} this period.`,
          amount: -net,
        },
  );

  const recommendations: AnalysisRecommendation[] = [];
  if (top) {
    recommendations.push({
      action: `Review your ${top.name} spending`,
      rationale: `It is your biggest category at ${top.percentage.toFixed(0)}% of spend.`,
      priority: "high",
    });
  }
  if (overBudget.length > 0) {
    recommendations.push({
      action: `Trim ${overBudget[0].name} back toward its budget`,
      rationale: `You're ${fmt(overBudget[0].spent - overBudget[0].budget)} over plan.`,
      estimatedImpact: overBudget[0].spent - overBudget[0].budget,
      priority: "medium",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      action: "Keep logging every transaction",
      rationale: "More data sharpens future analyses and trends.",
      priority: "low",
    });
  }

  const periodLabel = formatMonthLabel(context.currentMonth);
  const headline =
    net >= 0
      ? `${periodLabel}: you kept ${fmt(net)} — nice work.`
      : `${periodLabel}: spending ran ${fmt(-net)} ahead of income.`;

  const narrative = [
    `## ${periodLabel} overview`,
    "",
    `You spent **${fmt(totalSpent)}** and brought in **${fmt(totalIncome)}**, for a net of **${fmt(net)}**${totalIncome > 0 ? ` (a ${savingsRate.toFixed(0)}% savings rate)` : ""}.`,
    top
      ? `\nYour top category was **${top.name}** at ${fmt(top.amount)} (${top.percentage.toFixed(0)}% of spending).`
      : "",
    overBudget.length > 0
      ? `\n⚠️ You went over budget in ${overBudget.map((c) => c.name).join(", ")}.`
      : "",
    recommendations[0]
      ? `\n**Next step:** ${recommendations[0].action} — ${recommendations[0].rationale}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    period: { label: periodLabel },
    headline,
    narrative,
    kpis,
    categoryBreakdown,
    trend: (context.monthlyTrend || []).map((m) => ({
      period: m.period,
      income: m.income,
      expense: m.expense,
      net: m.net,
    })),
    insights,
    recommendations,
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-05" → "May 2026". Falls back to the raw input if unparseable. */
export function formatMonthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return ym || "";
  const idx = parseInt(m[2], 10) - 1;
  return `${MONTH_NAMES[idx] ?? ym} ${m[1]}`;
}
