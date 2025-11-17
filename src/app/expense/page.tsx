import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ExpensePage() {
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect unauthenticated users to login
    redirect("/login");
  }

  return (
    <main className="h-screen overflow-hidden">
      <MobileExpenseForm />
    </main>
  );
}
