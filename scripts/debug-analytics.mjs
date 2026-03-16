import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("Missing env vars", { url: !!url, key: !!key });
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: accounts, error: accErr } = await supabase
  .from("accounts")
  .select("id, name, type, user_id")
  .limit(20);
console.log("Accounts:", accounts?.length, "error:", accErr?.message || "none");
accounts?.forEach((a) =>
  console.log("  ", a.id.slice(0, 8), a.name, a.type, a.user_id.slice(0, 8)),
);

if (!accounts || accounts.length === 0) process.exit(0);

const accountIds = accounts.map((a) => a.id);

const { count } = await supabase
  .from("transactions")
  .select("id", { count: "exact", head: true })
  .in("account_id", accountIds);
console.log("\nTotal transactions:", count);

const { data: txs } = await supabase
  .from("transactions")
  .select("id, amount, date, account_id, category_id, is_debt_return")
  .in("account_id", accountIds)
  .gte("date", "2025-10-01")
  .order("date", { ascending: false })
  .limit(10);
console.log("\nRecent txs (since Oct 2025):", txs?.length);
txs?.forEach((t) => {
  const acct = accounts.find((a) => a.id === t.account_id);
  console.log(
    "  ",
    t.date,
    "$" + t.amount,
    acct?.name,
    "(" + acct?.type + ")",
    "cat:",
    t.category_id?.slice(0, 8) || "none",
  );
});

// Check user_categories for classification column
const { data: cats, error: catErr } = await supabase
  .from("user_categories")
  .select("id, name, classification")
  .limit(5);
console.log(
  "\nCategories sample:",
  cats?.length,
  "error:",
  catErr?.message || "none",
);
if (catErr) {
  console.log("Classification column might not exist. Checking without it...");
  const { data: cats2, error: catErr2 } = await supabase
    .from("user_categories")
    .select("id, name")
    .limit(5);
  console.log(
    "Categories without classification:",
    cats2?.length,
    "error:",
    catErr2?.message || "none",
  );
}
cats?.forEach((c) =>
  console.log("  ", c.id.slice(0, 8), c.name, "class:", c.classification),
);

// Check debts table
const { data: debts, error: debtErr } = await supabase
  .from("debts")
  .select("id")
  .limit(1);
console.log(
  "\nDebts table:",
  debts !== null ? "exists" : "missing",
  "error:",
  debtErr?.message || "none",
);

// Check recurring_payments
const { data: rp, error: rpErr } = await supabase
  .from("recurring_payments")
  .select("id")
  .limit(1);
console.log(
  "Recurring payments table:",
  rp !== null ? "exists" : "missing",
  "error:",
  rpErr?.message || "none",
);

// Check account_balances
const { data: bal, error: balErr } = await supabase
  .from("account_balances")
  .select("account_id, balance")
  .limit(5);
console.log(
  "Account balances:",
  bal?.length,
  "error:",
  balErr?.message || "none",
);
