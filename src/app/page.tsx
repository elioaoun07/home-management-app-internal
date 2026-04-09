import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPageClient from "./LandingPageClient";

export default async function Home() {
  // Check if user is already logged in.
  // getSession() reads from cookies — no network call, works on slow/offline connections.
  const supabase = await supabaseServerRSC();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If already authenticated, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingPageClient />;
}
