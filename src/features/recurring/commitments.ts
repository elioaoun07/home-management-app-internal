import { calculateNextDueDate, type RecurrenceType } from "@/lib/recurring";

export type RecurringCommitmentStatus =
  | "covered"
  | "matched"
  | "due_this_period"
  | "missed"
  | "upcoming"
  | "monitor";

export type RecurringCommitmentPayment = {
  id: string;
  name: string;
  amount: number;
  account_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  recurrence_type: RecurrenceType;
  recurrence_day?: number | null;
  next_due_date: string;
  last_processed_date?: string | null;
  payment_method?: "manual" | "auto";
};

export type RecurringMatchTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  account_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
};

export type RecurringTransactionMatch = {
  transaction: RecurringMatchTransaction;
  score: number;
  reasons: string[];
};

export type BillingPeriod = {
  start: string;
  end: string;
};

export type CommitmentStatusInfo = {
  status: RecurringCommitmentStatus;
  label: string;
  coveredDate?: string;
  dueDate: string;
  period: BillingPeriod;
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) throw new Error(`Invalid date-only value: ${value}`);
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampMonthStartDay(
  year: number,
  monthIndex: number,
  monthStartDay: number,
): number {
  const day = Number.isFinite(monthStartDay) ? Math.trunc(monthStartDay) : 1;
  return Math.min(Math.max(1, day), daysInUtcMonth(year, monthIndex));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function getCustomBillingPeriod(
  today: string,
  monthStartDay: number,
): BillingPeriod {
  const current = parseDateOnly(today);
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();
  const startDay = clampMonthStartDay(year, month, monthStartDay);
  const currentPeriodMonth = current.getUTCDate() >= startDay ? month : month - 1;
  const startBase = new Date(Date.UTC(year, currentPeriodMonth, 1));
  const start = new Date(
    Date.UTC(
      startBase.getUTCFullYear(),
      startBase.getUTCMonth(),
      clampMonthStartDay(
        startBase.getUTCFullYear(),
        startBase.getUTCMonth(),
        monthStartDay,
      ),
    ),
  );
  const nextBase = addUtcMonths(startBase, 1);
  const nextStart = new Date(
    Date.UTC(
      nextBase.getUTCFullYear(),
      nextBase.getUTCMonth(),
      clampMonthStartDay(
        nextBase.getUTCFullYear(),
        nextBase.getUTCMonth(),
        monthStartDay,
      ),
    ),
  );
  nextStart.setUTCDate(nextStart.getUTCDate() - 1);
  return { start: formatDateOnly(start), end: formatDateOnly(nextStart) };
}

export function isDateInPeriod(
  date: string | null | undefined,
  period: BillingPeriod,
): boolean {
  return !!date && date >= period.start && date <= period.end;
}

export function advanceRecurringPastDate({
  currentDueDate,
  recurrenceType,
  recurrenceDay,
  paidDate,
}: {
  currentDueDate: string;
  recurrenceType: RecurrenceType;
  recurrenceDay?: number | null;
  paidDate: string;
}): string {
  let nextDueDate = calculateNextDueDate({
    currentDueDate,
    recurrenceType,
    recurrenceDay,
  });

  for (let guard = 0; guard < 60 && nextDueDate <= paidDate; guard += 1) {
    nextDueDate = calculateNextDueDate({
      currentDueDate: nextDueDate,
      recurrenceType,
      recurrenceDay,
    });
  }

  return nextDueDate;
}

export function getRecurringCommitmentStatus({
  payment,
  today,
  monthStartDay,
  matchedDate,
  monitorOnly = false,
}: {
  payment: RecurringCommitmentPayment;
  today: string;
  monthStartDay: number;
  matchedDate?: string | null;
  monitorOnly?: boolean;
}): CommitmentStatusInfo {
  const period = getCustomBillingPeriod(today, monthStartDay);

  if (monitorOnly) {
    return {
      status: "monitor",
      label: `Monitor ${payment.next_due_date}`,
      dueDate: payment.next_due_date,
      period,
    };
  }

  if (isDateInPeriod(payment.last_processed_date, period)) {
    return {
      status: "covered",
      label: `Covered ${payment.last_processed_date}`,
      coveredDate: payment.last_processed_date ?? undefined,
      dueDate: payment.next_due_date,
      period,
    };
  }

  if (isDateInPeriod(matchedDate, period)) {
    return {
      status: "matched",
      label: `Matched ${matchedDate}`,
      coveredDate: matchedDate ?? undefined,
      dueDate: payment.next_due_date,
      period,
    };
  }

  if (payment.recurrence_type === "monthly") {
    if (payment.next_due_date < period.start) {
      return {
        status: "missed",
        label: `Missed ${payment.next_due_date}`,
        dueDate: payment.next_due_date,
        period,
      };
    }
    if (payment.next_due_date <= today && payment.next_due_date <= period.end) {
      return {
        status: "due_this_period",
        label: "Due this period",
        dueDate: payment.next_due_date,
        period,
      };
    }
    return {
      status: "upcoming",
      label: `Upcoming ${payment.next_due_date}`,
      dueDate: payment.next_due_date,
      period,
    };
  }

  if (payment.next_due_date < today) {
    return {
      status: "missed",
      label: `Missed ${payment.next_due_date}`,
      dueDate: payment.next_due_date,
      period,
    };
  }

  if (payment.next_due_date === today) {
    return {
      status: "due_this_period",
      label: "Due today",
      dueDate: payment.next_due_date,
      period,
    };
  }

  return {
    status: "upcoming",
    label: `Upcoming ${payment.next_due_date}`,
    dueDate: payment.next_due_date,
    period,
  };
}

export function normalizeRecurringText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(bill|payment|paid|manual|cash|online|purchase|pos|invoice|ref)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((t) => t.length >= 3));
  const rightTokens = new Set(right.split(" ").filter((t) => t.length >= 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) shared += 1;
  });
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

export function findRecurringTransactionMatches({
  payment,
  transactions,
  period,
}: {
  payment: RecurringCommitmentPayment;
  transactions: RecurringMatchTransaction[];
  period: BillingPeriod;
}): RecurringTransactionMatch[] {
  const paymentName = normalizeRecurringText(payment.name);

  return transactions
    .filter((tx) => isDateInPeriod(tx.date, period))
    .map((transaction) => {
      const reasons: string[] = [];
      let score = 0;
      const txText = normalizeRecurringText(transaction.description);
      const overlap = tokenOverlap(paymentName, txText);

      if (paymentName && txText && (txText.includes(paymentName) || paymentName.includes(txText))) {
        score += 45;
        reasons.push("name");
      } else if (overlap >= 0.5) {
        score += 32;
        reasons.push("words");
      } else if (overlap > 0) {
        score += Math.round(overlap * 20);
      }

      const amountDelta =
        Math.abs(Math.abs(transaction.amount) - Math.abs(payment.amount)) /
        Math.max(Math.abs(payment.amount), 1);
      if (amountDelta <= 0.05) {
        score += 30;
        reasons.push("amount");
      } else if (amountDelta <= 0.2) {
        score += 18;
        reasons.push("near amount");
      }

      if (transaction.account_id === payment.account_id) {
        score += 12;
        reasons.push("account");
      }
      if (payment.category_id && transaction.category_id === payment.category_id) {
        score += 10;
        reasons.push("category");
      }
      if (
        payment.subcategory_id &&
        transaction.subcategory_id === payment.subcategory_id
      ) {
        score += 5;
        reasons.push("subcategory");
      }

      return { transaction, score, reasons };
    })
    .filter((match) => match.score >= 55)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.transaction.date.localeCompare(a.transaction.date);
    });
}
