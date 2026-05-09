// Budget face reply formatter

export interface BudgetSpendData {
  total: number;
  scope: "self" | "partner" | "household";
  topCategory: string | null;
  topAmount: number | null;
  currency: "USD" | "LBP";
}

function fmtAmount(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const SCOPE_PHRASE: Record<string, string> = {
  self: "You've",
  partner: "Your partner has",
  household: "Between the two of you, you've",
};

export function formatMonthSpend(data: BudgetSpendData): string {
  const { total, scope, topCategory, topAmount } = data;
  const opener = SCOPE_PHRASE[scope] ?? "You've";

  if (total === 0) {
    return `${opener} spent nothing this period so far${topCategory ? ` on ${topCategory}` : ""}. Clean run.`;
  }

  const parts: string[] = [
    `${opener} spent ${fmtAmount(total)} so far this period.`,
  ];

  if (topCategory && topAmount) {
    parts.push(`Most of it went to ${topCategory} — ${fmtAmount(topAmount)}.`);
  }

  return parts.join(" ");
}

export function formatBudgetError(): string {
  return "I couldn't pull your spending data right now. Try again in a moment.";
}
