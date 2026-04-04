// src/app/nfc/[tag]/page.tsx
// Authenticated NFC tag interaction page
import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NfcTapClient from "./nfc-tap-client";

export const dynamic = "force-dynamic";

export default async function NfcTagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;

  // Auth check — redirect to login if not authenticated
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/nfc/${encodeURIComponent(tag)}`);
  }

  // Fetch user profile for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <NfcTapClient
      tagSlug={tag}
      displayName={profile?.full_name ?? user.email?.split("@")[0] ?? "User"}
    />
  );
}
