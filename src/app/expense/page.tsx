import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExpenseClientWrapper from "./ExpenseClientWrapper";

export default async function ExpensePage() {
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <ExpenseClientWrapper />;
}
