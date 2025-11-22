import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClientWrapper from "./DashboardClientWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await supabaseServerRSC();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure onboarding walkthrough for new users
  const { data: onboarding } = await supabase
    .from("user_onboarding")
    .select("completed, account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!onboarding?.completed) {
    redirect("/welcome");
  }

  return <DashboardClientWrapper />;
}
