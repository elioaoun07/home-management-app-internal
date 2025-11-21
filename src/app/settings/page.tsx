import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPage from "./SettingsPage";

export default async function SettingsRoute() {
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <SettingsPage />;
}
