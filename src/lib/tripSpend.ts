// Pure aggregation for GET /api/trips/[id]/spend.
// Sums in each account's own currency — never converted. Only `expense`
// accounts count: a tagged row on an income/saving account adds to that balance.

type AccountRef = { name: string; currency: string | null; type: string };

export type TripSpendRow = {
  id: string;
  date: string;
  amount: number | string;
  description: string | null;
  is_private: boolean | null;
  user_id: string;
  account: AccountRef | AccountRef[] | null;
};

export type TripSpendTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  account_name: string;
};

export function summarizeTripSpend(rows: TripSpendRow[], viewerId: string) {
  const byCurrency = new Map<string, { total: number; count: number }>();
  const transactions: TripSpendTransaction[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const account = Array.isArray(row.account) ? row.account[0] : row.account;
    if (!account || account.type !== "expense") continue;
    const currency = account.currency ?? "USD";
    const amount = Number(row.amount) || 0;
    const entry = byCurrency.get(currency) ?? { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    byCurrency.set(currency, entry);
    transactions.push({
      id: row.id,
      date: row.date,
      // A partner's private row still counts toward the total but stays opaque.
      description: row.is_private && row.user_id !== viewerId ? "" : (row.description ?? ""),
      amount,
      currency,
      account_name: account.name,
    });
  }

  const totals = [...byCurrency.entries()]
    .map(([currency, v]) => ({ currency, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  return { totals, transactions };
}
