import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPageClient from "./LandingPageClient";

export default async function Home() {
  // Check if user is already logged in
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return <LandingPageClient />;
}
