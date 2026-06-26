import { supabaseServerRSC } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ExpenseClientWrapper from "./ExpenseClientWrapper";

export const metadata: Metadata = {
  title: "Add Expense • Budget Manager",
  description:
    "Quickly add expenses, track transactions, and manage your daily spending",
  icons: {
    icon: [
      { url: "/expense-192.png", sizes: "192x192", type: "image/png" },
      { url: "/expense-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/expense-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/expense-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifests/expense.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Add Expense",
  },
};

function buildExpenseRedirectPath(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/expense?${query}` : "/expense";
}

export default async function ExpensePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseServerRSC();
  // getSession() reads from cookies — no network call, works on slow/offline connections.
  // getUser() makes a Supabase auth network call that hangs for 60 s on slow 3G.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const redirectPath = buildExpenseRedirectPath(resolvedSearchParams);
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  return <ExpenseClientWrapper />;
}
