import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPage from "./SettingsPage";

export default async function SettingsRoute() {
  const supabase = await supabaseServerRSC();
  // getSession() reads from cookies — no network call, works on slow/offline connections.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsPage />;
}
