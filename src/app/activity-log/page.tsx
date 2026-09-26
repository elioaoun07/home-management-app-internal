// src/app/activity-log/page.tsx
// Thin route wrapper — Hard Rule: pages are thin; real UI lives in components/.
import ActivityLogClient from "./ActivityLogClient";
import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage() {
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=%2Factivity-log");
  return <ActivityLogClient userId={user.id} />;
}
