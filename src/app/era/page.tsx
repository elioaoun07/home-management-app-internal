// src/app/era/page.tsx
// ERA — the omnipotent assistant interface. Phase 0 ships the skeleton:
// auth gate, registry-driven shell, stub IntentRouter. Phase 1 layers in the
// Claude-style fluid morph; Phase 2 wires Gemini.

import { EraShell } from "@/components/era/EraShell";
import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EraPage() {
  const supabase = await supabaseServerRSC();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  return <EraShell />;
}
