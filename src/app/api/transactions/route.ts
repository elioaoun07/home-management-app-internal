import { supabaseServer } from "@/lib/supabase/server";
import { SupabaseTransactionService } from "@/services/transaction.service";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const limit = parseInt(searchParams.get("limit") || "200");

    const service = new SupabaseTransactionService(supabase);
    const transactions = await service.getTransactions(user.id, {
      start,
      end,
      limit,
    });

    return NextResponse.json(transactions, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const service = new SupabaseTransactionService(supabase);
    const transaction = await service.createTransaction(user.id, body);

    return NextResponse.json(transaction, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("Failed to create transaction:", err);
    const message = err.message || "Failed to create transaction";
    const status =
      message.includes("required") || message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const service = new SupabaseTransactionService(supabase);
    const transaction = await service.updateTransaction(user.id, body);

    return NextResponse.json(transaction, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("Failed to update transaction:", e);
    const message = e.message || "Failed to update transaction";
    const status =
      message.includes("required") || message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
