import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClientWrapper from "./DashboardClientWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await supabaseServerRSC();

  // getSession() reads from cookies — no network call, works on slow/offline connections.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  // Ensure onboarding walkthrough for new users.
  // Only redirect when we KNOW onboarding is incomplete — if the DB query fails
  // (e.g. expired token, no network), `data` is null and we skip the redirect so
  // returning users aren't incorrectly bounced to /welcome on slow connections.
  const { data: onboarding } = await supabase
    .from("user_onboarding")
    .select("completed, account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (onboarding && !onboarding.completed) {
    redirect("/welcome");
  }

  return <DashboardClientWrapper />;
}
